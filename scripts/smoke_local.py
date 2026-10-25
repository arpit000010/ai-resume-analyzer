"""Real, offline PDF -> Express -> FastAPI -> CPU-model check. Cleans up listeners."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ['HF_HUB_OFFLINE'] = '1'
from nlp.app import create_app
import uvicorn

JD = '''About NVIDIA:
NVIDIA is a technology company creating accelerated computing products.
What we need to see:
- Programming experience with C/C++ and Linux.
- 5+ years of professional experience developing device drivers.
- Bachelor's degree in Computer Science or equivalent experience.
- Ability to communicate clearly with cross-functional teams.
Ways to stand out from the crowd:
- Familiarity with CUDA is a plus.
Benefits:
We offer generous benefits and opportunities for growth.
must.
'''
REPLACEMENT_RESUME = ['TECHNICAL SKILLS', 'C, C++, Python, Operating Systems, DSA, OOP', 'PROJECTS', '- Built Python services and C++ drivers.', 'EDUCATION', 'B.Tech CSE, completed 2023']
RESUME = ['TECHNICAL SKILLS', 'C/C++ and Linux; Python', 'EXPERIENCE',
          '- Developed C++ device drivers for Linux systems.',
          '- Diagnosed memory and concurrency defects in C services.',
          'EDUCATION', 'Bachelor of Science in Computer Science']


def run():
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    sock.listen(128)
    nlp_port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(create_app(), log_level='error', access_log=False))
    thread = threading.Thread(target=lambda: server.run(sockets=[sock]), daemon=True)
    node = None
    try:
        thread.start()
        deadline = time.monotonic() + 60
        while not server.started:
            if time.monotonic() > deadline:
                raise RuntimeError('NLP startup deadline exceeded. Download the model first.')
            time.sleep(0.1)
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1', 0))
            api_port = reservation.getsockname()[1]
        env = {**os.environ, 'PORT': str(api_port), 'HOST': '127.0.0.1',
               'NLP_SERVICE_URL': f'http://127.0.0.1:{nlp_port}', 'NLP_ENABLED': 'true', 'NLP_TIMEOUT_MS': '8000'}
        if os.getenv('SMOKE_BROWSER') == 'true':
            with socket.socket() as reservation:
                reservation.bind(('127.0.0.1', 0))
                env['BROWSER_PORT'] = str(reservation.getsockname()[1])
            env['CLIENT_ORIGINS'] = f"http://127.0.0.1:{env['BROWSER_PORT']}"
        node = subprocess.Popen(['node', 'server/index.js'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL)
        deadline = time.monotonic() + 10
        while True:
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{api_port}/api/health', timeout=1) as response:
                    assert response.status == 200
                break
            except (urllib.error.URLError, TimeoutError):
                if time.monotonic() > deadline:
                    raise RuntimeError('Express did not become healthy')
                time.sleep(0.1)
        pdf = subprocess.check_output(['node', '-e', 'process.stdout.write(require("./server/test/helpers/pdf")(' + json.dumps(RESUME) + '))'], cwd=ROOT)
        boundary = 'resumelens-local-smoke'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="resume"; filename="resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode() + pdf + f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="jobDescription"\r\n\r\n{JD}\r\n--{boundary}--\r\n'.encode())
        request = urllib.request.Request(f'http://127.0.0.1:{api_port}/api/analyze', data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
        with urllib.request.urlopen(request, timeout=25) as response:
            result = json.load(response)
        semantic = result['semantic']
        assert semantic['status'] == 'available', result
        assert semantic['analysisVersion'] == 'hybrid-requirements-v2', result
        assert semantic['requirementCount'] == 5, semantic
        assert all(item['requirement'].lower() != 'must.' for item in semantic['matches'])
        technical = next(item for item in semantic['matches'] if 'C/C++' in item['requirement'])
        assert technical['hybridStatus'] == 'supported', technical
        assert set(technical['matchedSkills']) == {'c', 'c++', 'linux'}, technical
        assert {item['category'] for item in semantic['matches']} == {'technical', 'experience', 'education', 'other'}
        assert next(item for item in semantic['matches'] if 'CUDA' in item['requirement'])['priority'] == 'preferred'
        assert next(item for item in semantic['matches'] if 'CUDA' in item['requirement'])['missingSkills'] == ['cuda']
        for skill in ['c', 'c++', 'linux']:
            assert skill in result['matchedSkills'], result
        if os.getenv('SMOKE_RESULT_PATH'):
            Path(os.environ['SMOKE_RESULT_PATH']).write_text(json.dumps(result, indent=2))
        print(json.dumps({'keywordCoverage': result['baselinePercentage'], 'requirements': semantic['requirementCount'],
                          'excludedPassages': semantic['excludedPassageCount'], 'cCppEvidenceStatus': technical['hybridStatus'],
                          'cCppCosine': technical['similarity'], 'categories': sorted({item['category'] for item in semantic['matches']})}))
        if os.getenv('SMOKE_BROWSER') == 'true':
            with tempfile.TemporaryDirectory(prefix='resumelens-fixture-') as directory:
                pdf_path = Path(directory) / 'systems-resume.pdf'
                jd_path = Path(directory) / 'job.txt'
                pdf_path.write_bytes(pdf)
                jd_path.write_text(JD)
                replacement_path = Path(directory) / 'replacement-resume.pdf'
                replacement_path.write_bytes(subprocess.check_output(['node', '-e', 'process.stdout.write(require("./server/test/helpers/pdf")(' + json.dumps(REPLACEMENT_RESUME) + '))'], cwd=ROOT))
                bad_path = Path(directory) / 'unreadable.pdf'
                bad_path.write_bytes(b'%PDF-1.4 broken fixture')
                kinds = {key: sum(item['evidenceKind'] == key for item in semantic['matches']) for key in ['explicit', 'contextual', 'uncertain', 'not_evidenced']}
                browser_env = {**env, 'API_PROXY_TARGET': f'http://127.0.0.1:{api_port}',
                               'SMOKE_PDF_PATH': str(pdf_path), 'SMOKE_JD_PATH': str(jd_path), 'SMOKE_REPLACEMENT_PATH': str(replacement_path), 'SMOKE_BAD_PDF_PATH': str(bad_path), 'SMOKE_EXPECTED_KINDS': json.dumps(kinds), 'VITE_API_BASE_URL': ''}
                subprocess.run(['node', 'scripts/browser_smoke.mjs'], cwd=ROOT, env=browser_env, check=True, timeout=90)
    finally:
        if node is not None:
            node.terminate()
            node.wait(timeout=5)
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()


if __name__ == '__main__':
    run()
