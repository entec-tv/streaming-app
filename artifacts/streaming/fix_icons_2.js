const fs = require("fs");
const path = require("path");

const iconMap = {
  MonitorBulk: "\"tv-outline\"",
  Search1Bulk: "\"search\"",
  User4Bulk: "\"person-circle-outline\"",
  Folder1Bulk: "\"folder-outline\"",
  HeartBulk: "\"heart\"",
  PlayBulk: "\"play\"",
  PauseBulk: "\"pause\"",
  StopwatchBulk: "\"stopwatch-outline\"",
  ArrowRightBulk: "\"chevron-forward\"",
  ArrowLeftBulk: "\"chevron-back\"",
  DashboardSquare1Bulk: "\"grid-outline\"",
  Trash3Bulk: "\"trash-outline\"",
  QuestionMarkCircleBulk: "\"help-circle-outline\"",
  StarFatBulk: "\"star\"",
  Link2AngularRightBulk: "\"link\"",
  FileMultipleBulk: "\"document-text-outline\"",
  CloudDownloadBulk: "\"download-outline\"",
  Download1Bulk: "\"download-outline\"",
  RefreshCircle1ClockwiseBulk: "\"refresh-outline\"",
  XmarkBulk: "\"close\"",
  CameraMovie1Bulk: "\"film-outline\"",
  PlusBulk: "\"add\"",
  VolumeMuteBulk: "\"volume-mute\"",
  VolumeLowBulk: "\"volume-low\"",
  VolumeHighBulk: "\"volume-high\"",
  Message2Bulk: "\"chatbubble-outline\"",
  PreviousStep2Bulk: "\"play-skip-back-outline\"",
  ShiftLeftBulk: "\"play-back-outline\"",
  NextStep2Bulk: "\"play-skip-forward-outline\"",
  ShiftRightBulk: "\"play-forward-outline\"",
  Ban2Bulk: "\"ban\"",
  CheckCircle1Bulk: "\"checkmark-circle-outline\"",
  Shield2Bulk: "\"shield-checkmark-outline\"",
  Tickets3Bulk: "\"ticket-outline\"",
  Locked1Bulk: "\"lock-closed-outline\"",
  Database2Bulk: "\"server-outline\"",
  EmojiSadBulk: "\"sad-outline\"",
  Microphone1Bulk: "\"mic-outline\"",
  Home2Bulk: "\"home-outline\"",
  CloudBolt1Bulk: "\"cloud-outline\"",
  Lineicons: "Ionicons"
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processFile(filePath) {
  if (!filePath.endsWith(".tsx")) return;
  let content = fs.readFileSync(filePath, "utf-8");
  
  let changed = false;
  for (const [key, value] of Object.entries(iconMap)) {
    if (key === "Lineicons") continue;
    // Replace standalone occurrences of the variable (that are not string literals or property keys)
    // We use a regex to match the exact word.
    const regex = new RegExp("\\b" + key + "\\b", "g");
    if (regex.test(content)) {
      content = content.replace(regex, value);
      changed = true;
    }
  }
  
  // Fix missing import Ionicons from @expo/vector-icons
  if (content.includes("<Ionicons") && !content.includes("import { Ionicons") && !content.includes("import {Ionicons")) {
      content = "import { Ionicons } from \"@expo/vector-icons\";\n" + content;
      changed = true;
  }

  if (changed) {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log("Fixed", filePath);
  }
}

walkDir("c:/streaming/artifacts/streaming/app", processFile);
walkDir("c:/streaming/artifacts/streaming/components", processFile);

