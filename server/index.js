const express = require("express");
const cors = require("cors");

const analyzeRoutes = require("./routes/analyzeRoutes");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://ai-resume-analyzer-dusky-six.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  })
);

app.use(express.json());

app.use("/api/analyze", analyzeRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
