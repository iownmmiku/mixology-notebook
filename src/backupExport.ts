import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function backupFilename() {
  const now = new Date();
  const pad = (value: number, length = 2) =>
    String(value).padStart(length, "0");
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`;
  return `调酒手册-备份-${day}-${time}.json`;
}

/** Accept only the credential-free JSON returned by storage.exportBackup(). */
export async function exportBackupFile(text: string): Promise<string> {
  const filename = backupFilename();
  if (Capacitor.isNativePlatform()) {
    let uri: string;
    try {
      const result = await Filesystem.writeFile({
        path: `mixology-backups/${filename}`,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        data: text,
        recursive: true,
      });
      uri = result.uri;
    } catch {
      throw new Error("无法生成备份文件，请检查设备存储空间后重试。");
    }
    try {
      await Share.share({
        files: [uri],
        title: "调酒手册备份",
        dialogTitle: "保存或分享备份",
      });
    } catch {
      throw new Error(
        "备份已生成，但分享未完成。请重新导出，并在分享面板选择保存位置。",
      );
    }
    // Keep the cache file available while the receiving app copies it.
    return "备份已生成，请在分享面板保存（不包含 API 密钥）";
  }

  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } catch {
    throw new Error("浏览器未能下载备份，请检查下载权限后重试。");
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return "备份已导出，不包含 API 密钥";
}
