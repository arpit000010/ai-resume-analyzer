const MODEL = "sentence-transformers/all-MiniLM-L6-v2";
module.exports = function validate(result) {
  const boundedString = (value, max) => typeof value === "string" && value.length > 0 && [...value].length <= max;
  if (result?.status !== "available" || result.method !== "passage-cosine-v1" || result.model !== MODEL ||
      !(result.revision === null || boundedString(result.revision, 100)) ||
      result.thresholds?.strong !== 0.65 || result.thresholds?.possible !== 0.4 ||
      !boundedString(result.explanation, 2000) ||
      !Number.isInteger(result.resumePassageCount) || result.resumePassageCount < 1 || result.resumePassageCount > 160 ||
      !Array.isArray(result.matches) || (result.matches.length < 1 && result.analysisVersion !== "hybrid-requirements-v2") || result.matches.length > 80 ||
      result.requirementCount !== result.matches.length) throw new Error("Invalid NLP contract");
  const matches = result.matches.map((match) => {
    const expected = match.similarity >= 0.65 ? "strong" : match.similarity >= 0.4 ? "possible" : "weak";
    if (!boundedString(match.requirement, 600) || !Number.isFinite(match.similarity) || match.similarity < -1 || match.similarity > 1 || match.status !== expected ||
        !boundedString(match.evidence?.text, 600) || !Number.isInteger(match.evidence.passageIndex) ||
        match.evidence.passageIndex < 0 || match.evidence.passageIndex >= result.resumePassageCount) throw new Error("Invalid NLP match");
    const output = { requirement: match.requirement, similarity: match.similarity, status: match.status,
      evidence: { text: match.evidence.text, passageIndex: match.evidence.passageIndex } };
    for (const field of ['section', 'relevant']) {
      if (match.evidence[field] !== undefined) {
        if (field === 'section' ? !boundedString(match.evidence[field], 100) : typeof match.evidence[field] !== 'boolean') throw new Error('Invalid evidence metadata');
        output.evidence[field] = match.evidence[field];
      }
    }
    if (result.analysisVersion === "hybrid-requirements-v2") {
      const strings = (items, max = 80) => Array.isArray(items) && items.length <= max && items.every((value) => boundedString(value, 600));
      if (!["technical", "experience", "education", "other"].includes(match.category) ||
          !["required", "preferred", "optional", "responsibility", "unspecified"].includes(match.priority) ||
          !["supported", "uncertain", "missing"].includes(match.hybridStatus) ||
          !["explicit_skills", "explicit_education", "contextual", "insufficient_evidence"].includes(match.basis) ||
          !strings(match.matchedSkills) || !strings(match.missingSkills) || !strings(match.uncertainty, 12) ||
          !Array.isArray(match.skillEvidence) || match.skillEvidence.length > 80 ||
          match.skillEvidence.some((item) => !boundedString(item.skill, 100) || !boundedString(item.text, 600) || !Number.isInteger(item.passageIndex) || item.passageIndex < 0 || item.passageIndex >= result.resumePassageCount)) throw new Error("Invalid hybrid contract");
      Object.assign(output, { category: match.category, priority: match.priority, hybridStatus: match.hybridStatus,
        basis: match.basis, matchedSkills: match.matchedSkills, missingSkills: match.missingSkills,
        uncertainty: match.uncertainty, skillEvidence: match.skillEvidence.map(({ skill, text, passageIndex, section }) => {
          if (section !== undefined && !boundedString(section, 100)) throw new Error('Invalid skill evidence section');
          return { skill, text, passageIndex, ...(section === undefined ? {} : { section }) };
        }) });
      if (match.evidenceKind !== undefined) {
        const legacy = { explicit: 'supported', contextual: 'uncertain', uncertain: 'uncertain', not_evidenced: 'missing' };
        if (!Object.hasOwn(legacy, match.evidenceKind) || legacy[match.evidenceKind] !== match.hybridStatus ||
            (match.evidenceKind === 'explicit' && (match.missingSkills.length > 0 || match.evidence.relevant === false || !['explicit_skills', 'explicit_education'].includes(match.basis) || match.extractionConfidence === 'uncertain')) ||
            !['explicit', 'section', 'uncertain'].includes(match.extractionConfidence) ||
            !(match.sourceSection === null || boundedString(match.sourceSection, 100)) || !strings(match.alternativeSkills) ||
            !Array.isArray(match.skillConditions) || match.skillConditions.length > 80 ||
            match.skillConditions.some((condition) => !strings(condition.anyOf) || !condition.anyOf.length || !strings(condition.matched) ||
              condition.matched.some((skill) => !condition.anyOf.includes(skill) || !match.matchedSkills.includes(skill)) ||
              condition.satisfied !== (condition.matched.length > 0))) throw new Error('Invalid final evidence classification');
        const missing = new Set(match.skillConditions.filter((condition) => !condition.satisfied).flatMap((condition) => condition.anyOf));
        if (missing.size !== new Set(match.missingSkills).size || match.missingSkills.some((skill) => !missing.has(skill))) throw new Error('Inconsistent missing skill conditions');
        Object.assign(output, { evidenceKind: match.evidenceKind, sourceSection: match.sourceSection,
          extractionConfidence: match.extractionConfidence, alternativeSkills: match.alternativeSkills,
          skillConditions: match.skillConditions.map(({ anyOf, matched, satisfied }) => ({ anyOf, matched, satisfied })) });
      }
    }
    return output;
  });
  const output = { status: "available", method: result.method, model: MODEL, revision: result.revision,
    explanation: result.explanation, thresholds: { strong: 0.65, possible: 0.4 },
    requirementCount: matches.length, resumePassageCount: result.resumePassageCount, matches };
  if (result.analysisVersion === "hybrid-requirements-v2") {
    if (!Number.isInteger(result.excludedPassageCount) || result.excludedPassageCount < 0 ||
        !Array.isArray(result.warnings) || result.warnings.length > 10 || result.warnings.some((warning) => !boundedString(warning, 600))) throw new Error("Invalid extraction metadata");
    Object.assign(output, { analysisVersion: result.analysisVersion, excludedPassageCount: result.excludedPassageCount, warnings: result.warnings });
  }
  return output;
};
