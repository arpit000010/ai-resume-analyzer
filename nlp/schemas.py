from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal
from nlp.config import MAX_RESUME_CHARS, MAX_JD_CHARS

class MatchInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    resumeText: str = Field(min_length=1, max_length=MAX_RESUME_CHARS)
    jobDescription: str = Field(min_length=20, max_length=MAX_JD_CHARS)

    @field_validator("resumeText", "jobDescription")
    @classmethod
    def readable(cls, value):
        if not any(char.isalnum() for char in value):
            raise ValueError("Readable text is required")
        return value

    @field_validator("jobDescription")
    @classmethod
    def meaningful_description(cls, value):
        if len(value.strip()) < 20:
            raise ValueError("Job description must contain at least 20 characters after trimming")
        return value


class Evidence(BaseModel):
    text: str
    passageIndex: int = Field(ge=0)
    section: str = 'unspecified'
    relevant: bool = True


class SkillEvidence(Evidence):
    skill: str


class SkillCondition(BaseModel):
    anyOf: list[str]
    matched: list[str]
    satisfied: bool


class RequirementMatch(BaseModel):
    requirement: str
    category: Literal['technical', 'experience', 'education', 'other']
    priority: Literal['required', 'preferred', 'optional', 'responsibility', 'unspecified']
    similarity: float = Field(ge=-1, le=1)
    status: Literal['strong', 'possible', 'weak']
    hybridStatus: Literal['supported', 'uncertain', 'missing']
    basis: Literal['explicit_skills', 'explicit_education', 'contextual', 'insufficient_evidence']
    evidenceKind: Literal['explicit', 'contextual', 'not_evidenced', 'uncertain']
    sourceSection: str | None = None
    extractionConfidence: Literal['explicit', 'section', 'uncertain']
    alternativeSkills: list[str]
    skillConditions: list[SkillCondition]
    matchedSkills: list[str]
    missingSkills: list[str]
    skillEvidence: list[SkillEvidence]
    uncertainty: list[str]
    evidence: Evidence


class MatchOutput(BaseModel):
    status: Literal['available']
    method: Literal['passage-cosine-v1']
    analysisVersion: Literal['hybrid-requirements-v2']
    model: str
    revision: str | None
    thresholds: dict[str, float]
    explanation: str
    resumePassageCount: int = Field(ge=1, le=160)
    requirementCount: int = Field(ge=0, le=80)
    excludedPassageCount: int = Field(ge=0)
    matches: list[RequirementMatch]
    warnings: list[str]

