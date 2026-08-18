const fs = require("fs");
const path = require("path");

const iconMap = {
  MonitorBulk: "tv-outline",
  Search1Bulk: "search",
  User4Bulk: "person-circle-outline",
  Folder1Bulk: "folder-outline",
  HeartBulk: "heart",
  PlayBulk: "play",
  PauseBulk: "pause",
  StopwatchBulk: "stopwatch-outline",
  ArrowRightBulk: "chevron-forward",
  ArrowLeftBulk: "chevron-back",
  DashboardSquare1Bulk: "grid-outline",
  Trash3Bulk: "trash-outline",
  QuestionMarkCircleBulk: "help-circle-outline",
  StarFatBulk: "star",
  Link2AngularRightBulk: "link",
  FileMultipleBulk: "document-text-outline",
  CloudDownloadBulk: "download-outline",
  Download1Bulk: "download-outline",
  RefreshCircle1ClockwiseBulk: "refresh-outline",
  XmarkBulk: "close",
  CameraMovie1Bulk: "film-outline",
  PlusBulk: "add",
  VolumeMuteBulk: "volume-mute",
  VolumeLowBulk: "volume-low",
  VolumeHighBulk: "volume-high",
  Message2Bulk: "chatbubble-outline",
  PreviousStep2Bulk: "play-skip-back-outline",
  ShiftLeftBulk: "play-back-outline",
  NextStep2Bulk: "play-skip-forward-outline",
  ShiftRightBulk: "play-forward-outline",
  Ban2Bulk: "ban",
  CheckCircle1Bulk: "checkmark-circle-outline",
  Shield2Bulk: "shield-checkmark-outline",
  Tickets3Bulk: "ticket-outline",
  Locked1Bulk: "lock-closed-outline",
  Database2Bulk: "server-outline",
  EmojiSadBulk: "sad-outline",
  Microphone1Bulk: "mic-outline",
  Home2Bulk: "home-outline",
  CloudBolt1Bulk: "cloud-outline",
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
  if (!content.includes("Lineicons") && !content.includes("@lineiconshq/free-icons")) return;

  // Remove Lineicons imports
  content = content.replace(/import\s+{\s*Lineicons\s*}\s+from\s+.[@a-zA-Z0-9/-]+react-native-lineicons.[;\n]*/g, "");
  
  // Remove free-icons imports
  content = content.replace(/import\s+{\s*[a-zA-Z0-9,\s]*\s*}\s+from\s+.[@a-zA-Z0-9/-]+free-icons.[;\n]*/g, "");

  // Make sure Ionicons is imported if we are using it
  if (!content.includes("import { Ionicons")) {
    // try to add to expo vector icons if exists
    if (content.includes("@expo/vector-icons")) {
        content = content.replace(/import\s+{(.*?)}\s+from\s+.@expo\/vector-icons.;/g, "import { $1, Ionicons } from \"@expo/vector-icons\";");
    } else {
        content = "import { Ionicons } from \"@expo/vector-icons\";\n" + content;
    }
  }

  // Replace <Lineicons icon={Name} ... /> with <Ionicons name="mapped" ... />
  // Note: some icons are passed as variables, some are literal
  for (const [key, value] of Object.entries(iconMap)) {
    // <Lineicons icon={MonitorBulk}
    content = content.replace(new RegExp("<Lineicons\\s+icon={" + key + "}", "g"), `<Ionicons name="${value}"`);
    // bulkIcon: MonitorBulk
    content = content.replace(new RegExp("bulkIcon:\\s*" + key, "g"), `bulkIcon: "${value}"`);
    content = content.replace(new RegExp("icon={" + key + "}", "g"), `name="${value}"`);
  }

  // General catchall for Lineicons tag
  content = content.replace(/<Lineicons/g, "<Ionicons");
  
  // Fix tvSidebar.tsx specific issue where Lineicons takes bulkIcon dynamically
  // <Ionicons icon={bulkIcon} => <Ionicons name={bulkIcon}
  content = content.replace(/<Ionicons\s+icon=/g, "<Ionicons name=");

  fs.writeFileSync(filePath, content, "utf-8");
  console.log("Fixed", filePath);
}

walkDir("c:/streaming/artifacts/streaming/app", processFile);
walkDir("c:/streaming/artifacts/streaming/components", processFile);

