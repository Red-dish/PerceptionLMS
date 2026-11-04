// Grade calculation for the Marks section. No page code here, so it can be tested on its own.

const GRADE_SCALE = [
  { grade: 'HD', label: 'High Distinction', min: 85 },
  { grade: 'D', label: 'Distinction', min: 75 },
  { grade: 'C', label: 'Credit', min: 65 },
  { grade: 'P', label: 'Pass', min: 50 },
  { grade: 'F', label: 'Fail', min: 0 }
];

// Avoids floating point errors such as 0.1 + 0.2 = 0.30000000000000004
function roundTo(value, places) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isValidScore(score, max) {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= max;
}

function totalWeight(assessments) {
  return roundTo(assessments.reduce((sum, assessment) => sum + assessment.weight, 0), 2);
}

// The final mark is rounded to a whole number before the grade is chosen (84.5 -> 85 -> HD)
function gradeFor(percent) {
  const finalMark = Math.round(roundTo(percent, 2));
  return GRADE_SCALE.find(band => finalMark >= band.min);
}

// scores looks like { 'cs301-a1': 17, 'cs301-a2': 21 }. Missing assessments are "not marked yet".
function calculateResult(assessments, scores = {}) {
  let earned = 0;
  let assessedWeight = 0;

  assessments.forEach(assessment => {
    const score = scores[assessment.id];
    if (!isValidScore(score, assessment.max)) return;
    earned += (score / assessment.max) * assessment.weight;
    assessedWeight += assessment.weight;
  });

  const complete = assessments.length > 0
    && totalWeight(assessments) === 100
    && assessments.every(assessment => isValidScore(scores[assessment.id], assessment.max));

  return {
    percent: roundTo(earned, 2),
    assessedWeight: roundTo(assessedWeight, 2),
    markedAverage: assessedWeight > 0 ? roundTo((earned / assessedWeight) * 100, 2) : null,
    complete,
    finalMark: complete ? Math.round(roundTo(earned, 2)) : null,
    grade: complete ? gradeFor(earned) : null
  };
}
