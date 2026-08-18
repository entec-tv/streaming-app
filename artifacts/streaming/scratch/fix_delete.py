import re

files = [
    ('c:/streaming/artifacts/streaming/app/movie-detail.tsx', r'try \{\s*await FileSystem.deleteAsync\(downloadedItem.localUri, \{ idempotent: true \}\);\s*removeDownload\(params\.id \|\| \'\'\);\s*\} catch \(e\) \{\s*console\.error\("Failed to delete", e\);\s*\}', 'try {\n        if (Platform.OS !== \'web\') {\n          await FileSystem.deleteAsync(downloadedItem.localUri, { idempotent: true });\n        }\n      } catch (e) {\n        console.error("Failed to delete", e);\n      } finally {\n        removeDownload(params.id || \'\');\n      }'),
    ('c:/streaming/artifacts/streaming/app/series-detail.tsx', r'try \{\s*await FileSystem.deleteAsync\(downloadedItem.localUri, \{ idempotent: true \}\);\s*removeDownload\(ep\.id\);\s*\} catch \(e\) \{\s*console\.error\("Failed to delete", e\);\s*\}', 'try {\n        if (Platform.OS !== \'web\') {\n          await FileSystem.deleteAsync(downloadedItem.localUri, { idempotent: true });\n        }\n      } catch (e) {\n        console.error("Failed to delete", e);\n      } finally {\n        removeDownload(ep.id);\n      }'),
    ('c:/streaming/artifacts/streaming/store/app-store.ts', r'if \(download && download\.localUri\) \{\s*try \{\s*await FileSystem\.deleteAsync\(download\.localUri, \{ idempotent: true \}\);\s*\} catch \(e\) \{\}\s*\}', 'if (download && download.localUri) {\n      try {\n        if (Platform.OS !== \'web\') {\n          await FileSystem.deleteAsync(download.localUri, { idempotent: true });\n        }\n      } catch (e) {}\n    }'),
    ('c:/streaming/artifacts/streaming/lib/storage.ts', r'try \{\s*await FileSystem\.deleteAsync\(uri, \{ idempotent: true \}\);\s*\} catch \(e\) \{\s*console\.error\("Failed to delete file:", e\);\s*\}', 'try {\n    if (Platform.OS !== \'web\') {\n      await FileSystem.deleteAsync(uri, { idempotent: true });\n    }\n  } catch (e) {\n    console.error("Failed to delete file:", e);\n  }')
]

for filepath, pattern, replacement in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = re.sub(pattern, replacement, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
