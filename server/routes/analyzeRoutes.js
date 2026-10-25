const router = require("express").Router();
const upload = require("../middleware/upload");
const requestGuard = require("../middleware/requestGuard");
const { analyzeResume } = require("../controllers/analyzeController");
router.post("/", requestGuard, upload.single("resume"), analyzeResume);
module.exports = router;
