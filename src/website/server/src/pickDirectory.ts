/**
 * Native folder dialog for the local website harness.
 * The browser cannot yield a real filesystem path; the Node bridge can.
 * Windows uses IFileOpenDialog (Vista+ "Select Workspace Directory"), matching
 * the DeepSeek Harness host picker rather than FolderBrowserDialog.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const TITLE = "Select Workspace Directory";
const DIALOG_CS = fileURLToPath(new URL("./winVistaFolderDialog.cs", import.meta.url));

/** Fallback when the .cs sibling is not copied next to dist. */
const EMBEDDED_CS = `using System;
using System.Runtime.InteropServices;

namespace Cantilune
{
    public static class VistaFolderDialog
    {
        private const uint FosPickFolders = 0x00000020;
        private const uint FosForceFileSystem = 0x00000040;
        private const uint FosNoChangeDir = 0x00000008;
        private const uint SigdnFileSysPath = 0x80058000;

        [ComImport]
        [Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
        private class FileOpenDialogCom { }

        [ComImport]
        [Guid("42f85136-db7e-439c-85f1-e4075d135fc8")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IFileDialog
        {
            [PreserveSig] int Show(IntPtr parent);
            void SetFileTypes(uint cFileTypes, IntPtr rgFilterSpec);
            void SetFileTypeIndex(uint iFileType);
            void GetFileTypeIndex(out uint piFileType);
            void Advise(IntPtr pfde, out uint pdwCookie);
            void Unadvise(uint dwCookie);
            void SetOptions(uint fos);
            void GetOptions(out uint fos);
            void SetDefaultFolder(IShellItem psi);
            void SetFolder(IShellItem psi);
            void GetFolder(out IShellItem ppsi);
            void GetCurrentSelection(out IShellItem ppsi);
            void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
            void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
            void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
            void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
            void GetResult(out IShellItem ppsi);
            void AddPlace(IShellItem psi, int fdap);
            void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
            void Close(int hr);
            void SetClientGuid(ref Guid guid);
            void ClearClientData();
            void SetFilter(IntPtr pFilter);
        }

        [ComImport]
        [Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IShellItem
        {
            void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
            void GetParent(out IShellItem ppsi);
            void GetDisplayName(uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
            void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
            void Compare(IShellItem psi, uint hint, out int piOrder);
        }

        public static string Pick(string title)
        {
            var dialog = (IFileDialog)new FileOpenDialogCom();
            dialog.SetOptions(FosPickFolders | FosForceFileSystem | FosNoChangeDir);
            dialog.SetTitle(string.IsNullOrEmpty(title) ? "Select Workspace Directory" : title);
            var hr = dialog.Show(IntPtr.Zero);
            if (hr != 0)
            {
                return null;
            }
            IShellItem item;
            dialog.GetResult(out item);
            string path;
            item.GetDisplayName(SigdnFileSysPath, out path);
            return path;
        }
    }
}
`;

function escapePs(value: string): string {
  return value.replaceAll("'", "''");
}

async function loadDialogSource(): Promise<string> {
  if (existsSync(DIALOG_CS)) {
    return readFile(DIALOG_CS, "utf8");
  }
  return EMBEDDED_CS;
}

export async function pickDirectory(_initial?: string): Promise<string | undefined> {
  if (process.platform === "win32") {
    const source = await loadDialogSource();
    const csPath = join(tmpdir(), `cantilune-vista-folder-${process.pid}.cs`);
    await writeFile(csPath, source, "utf8");
    const script = [
      `$src = Get-Content -LiteralPath '${escapePs(csPath)}' -Raw`,
      "Add-Type -TypeDefinition $src -Language CSharp",
      `$p = [Cantilune.VistaFolderDialog]::Pick('${escapePs(TITLE)}')`,
      "if ($p) { [Console]::Out.Write($p) }",
    ].join("; ");
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-STA", "-Command", script],
        { timeout: 180_000, windowsHide: false },
      );
      const path = stdout.trim();
      return path.length > 0 ? path : undefined;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Select Workspace Directory failed: ${detail}`);
    }
  }
  if (process.platform === "darwin") {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-e", `POSIX path of (choose folder with prompt "${TITLE}")`],
      { timeout: 180_000 },
    );
    const path = stdout.trim().replace(/\/$/, "");
    return path.length > 0 ? path : undefined;
  }
  try {
    const { stdout } = await execFileAsync(
      "zenity",
      ["--file-selection", "--directory", `--title=${TITLE}`],
      { timeout: 180_000 },
    );
    const path = stdout.trim();
    return path.length > 0 ? path : undefined;
  } catch {
    return undefined;
  }
}
