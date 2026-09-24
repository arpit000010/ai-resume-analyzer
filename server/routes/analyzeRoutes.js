const express = require("express");
const multer = require("multer");
const { analyzeResume } = require("../controllers/analyzeController");

const router = express.Router();

const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF and DOCX files are allowed."));
        }
    }
});

router.post("/", upload.single("resume"), analyzeResume);

module.exports = router;
