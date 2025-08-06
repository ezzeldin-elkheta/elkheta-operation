/*
 * Test Final Minutes Update
 * This script tests the final minutes update functionality to ensure it only updates
 * non-question videos and skips QV videos
 */

const testVideos = [
  // Regular videos (should get final minutes updated)
  {
    name: "M2-T2-U2-L2-SCI-AR-P0078-محمد-عبدالرحمن-الحصة-2.mp4",
    final_minutes: 45,
    expected: "updated"
  },
  {
    name: "M2-T2-U2-L3-SCI-AR-P0078-محمد-عبدالرحمن-الحصة-3.mp4",
    final_minutes: 52,
    expected: "updated"
  },
  {
    name: "M2-T2-U2-L4-SCI-AR-P0078-محمد-عبدالرحمن-الحصة-4.mp4",
    final_minutes: 38,
    expected: "updated"
  },
  
  // Question videos (should be skipped)
  {
    name: "M2-T2-U2-L2-SCI-AR-P0078-محمد-عبدالرحمن-الحصة-2-Q1.mp4",
    final_minutes: 15,
    expected: "skipped"
  },
  {
    name: "M2-T2-U2-L3-SCI-AR-P0078-محمد-عبدالرحمن-الحصة-3-Q2.mp4",
    final_minutes: 12,
    expected: "skipped"
  },
  {
    name: "M2-T2-U2-L4-SCI-AR-P0078-محمد-عبدالرحمن-الحصة-4-Q3.mp4",
    final_minutes: 18,
    expected: "skipped"
  },
  
  // Arabic question videos
  {
    name: "M2-T2-U2-L2-SCI-AR-P0078-محمد-عبدالرحمن-سؤال-1.mp4",
    final_minutes: 20,
    expected: "skipped"
  },
  {
    name: "M2-T2-U2-L3-SCI-AR-P0078-محمد-عبدالرحمن-أسئلة-2.mp4",
    final_minutes: 25,
    expected: "skipped"
  },
  
  // Exam/Test videos
  {
    name: "M2-T2-U2-L2-SCI-AR-P0078-محمد-عبدالرحمن-اختبار-1.mp4",
    final_minutes: 30,
    expected: "skipped"
  },
  {
    name: "M2-T2-U2-L3-SCI-AR-P0078-محمد-عبدالرحمن-امتحان-2.mp4",
    final_minutes: 35,
    expected: "skipped"
  },
  
  // Quiz/Test keywords
  {
    name: "M2-T2-U2-L2-SCI-AR-P0078-محمد-عبدالرحمن-Quiz-1.mp4",
    final_minutes: 22,
    expected: "skipped"
  },
  {
    name: "M2-T2-U2-L3-SCI-AR-P0078-محمد-عبدالرحمن-Test-2.mp4",
    final_minutes: 28,
    expected: "skipped"
  },
  
  // Homework with numbers
  {
    name: "M2-T2-U2-L2-SCI-AR-P0078-محمد-عبدالرحمن-HW-1.mp4",
    final_minutes: 16,
    expected: "skipped"
  },
  {
    name: "M2-T2-U2-L3-SCI-AR-P0078-محمد-عبدالرحمن-Homework-2.mp4",
    final_minutes: 19,
    expected: "skipped"
  }
];

// Function to detect if video is a question/quiz (QV) video
function isQuestionVideo(videoName) {
  if (!videoName) return false;
  
  // Check for Q+number pattern anywhere in filename (most reliable indicator)
  if (/[Qq]\d+/.test(videoName)) {
    console.log(`[isQuestionVideo] Video "${videoName}" has Q-number pattern - treating as question video`);
    return true;
  }
  
  // Check for Arabic question indicators with numbers
  if (/سؤال\s*\d+|أسئلة\s*\d+/.test(videoName)) {
    console.log(`[isQuestionVideo] Video "${videoName}" has Arabic question pattern - treating as question video`);
    return true;
  }
  
  // Check for exam/test indicators with numbers
  if (/اختبار\s*\d+|امتحان\s*\d+/.test(videoName)) {
    console.log(`[isQuestionVideo] Video "${videoName}" has exam/test pattern - treating as question video`);
    return true;
  }
  
  // Check for quiz or test keywords (but only if they appear to be main components)
  if (/\bquiz\b|\btest\b|\bexam\b/i.test(videoName) && 
      (!/\b[a-z]+\s+quiz\b/i.test(videoName))) {
    console.log(`[isQuestionVideo] Video "${videoName}" has quiz/test keyword - treating as question video`);
    return true;
  }
  
  // Check for homework indicators with question numbers
  if (/\bhw\s*\d+\b|\bhomework\s*\d+\b/i.test(videoName)) {
    console.log(`[isQuestionVideo] Video "${videoName}" has homework with numbers - treating as question video`);
    return true;
  }
  
  // Additional check for Arabic question words without numbers (but with context)
  if (/سؤال|أسئلة/.test(videoName) && /\d+/.test(videoName)) {
    console.log(`[isQuestionVideo] Video "${videoName}" has Arabic question word with number - treating as question video`);
    return true;
  }
  
  // Additional check for Arabic exam/test words without numbers (but with context)
  if (/اختبار|امتحان/.test(videoName) && /\d+/.test(videoName)) {
    console.log(`[isQuestionVideo] Video "${videoName}" has Arabic exam/test word with number - treating as question video`);
    return true;
  }
  
  // Additional check for homework words with numbers
  if (/\bhw\b|\bhomework\b/i.test(videoName) && /\d+/.test(videoName)) {
    console.log(`[isQuestionVideo] Video "${videoName}" has homework word with number - treating as question video`);
    return true;
  }
  
  console.log(`[isQuestionVideo] Video "${videoName}" is NOT a question video - will update final minutes`);
  return false;
}

// Test the detection function
console.log("🧪 Testing Final Minutes Update Logic");
console.log("=" .repeat(50));

let passedTests = 0;
let totalTests = testVideos.length;

testVideos.forEach((video, index) => {
  console.log(`\n📹 Test ${index + 1}: "${video.name}"`);
  console.log(`⏱️ Duration: ${video.final_minutes} minutes`);
  console.log(`🎯 Expected: ${video.expected}`);
  
  const isQuestion = isQuestionVideo(video.name);
  const actualResult = isQuestion ? "skipped" : "updated";
  
  console.log(`🔍 Detected as question: ${isQuestion}`);
  console.log(`📊 Actual result: ${actualResult}`);
  
  if (actualResult === video.expected) {
    console.log(`✅ PASSED`);
    passedTests++;
  } else {
    console.log(`❌ FAILED - Expected ${video.expected}, got ${actualResult}`);
  }
});

console.log("\n" + "=" .repeat(50));
console.log(`📈 Test Results: ${passedTests}/${totalTests} tests passed`);
console.log(`📊 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log("🎉 All tests passed! Final minutes update logic is working correctly.");
} else {
  console.log("⚠️ Some tests failed. Please review the logic.");
}

// Summary by category
const regularVideos = testVideos.filter(v => v.expected === "updated");
const questionVideos = testVideos.filter(v => v.expected === "skipped");

console.log("\n📋 Summary:");
console.log(`📹 Regular videos: ${regularVideos.length} (should be updated)`);
console.log(`❓ Question videos: ${questionVideos.length} (should be skipped)`);

const regularPassed = regularVideos.filter(v => !isQuestionVideo(v.name)).length;
const questionPassed = questionVideos.filter(v => isQuestionVideo(v.name)).length;

console.log(`✅ Regular videos correctly identified: ${regularPassed}/${regularVideos.length}`);
console.log(`✅ Question videos correctly identified: ${questionPassed}/${questionVideos.length}`); 