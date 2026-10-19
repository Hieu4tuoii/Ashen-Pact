import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASE_ROOT = path.join(ROOT_DIR, 'release');
const RELEASE_NAME = 'AshenPact-v0.1.0-win-x64';
const RELEASE_DIR = path.join(RELEASE_ROOT, RELEASE_NAME);
const RELEASE_ZIP = path.join(RELEASE_ROOT, `${RELEASE_NAME}.zip`);

interface EsbuildModule {
  buildSync(options: Record<string, unknown>): void;
}

function resolveEsbuild(): EsbuildModule {
  const reqRoot = createRequire(path.join(ROOT_DIR, 'apps/server/package.json'));
  const tsxPkgPath = reqRoot.resolve('tsx/package.json');
  const reqTsx = createRequire(tsxPkgPath);
  return reqTsx('esbuild') as EsbuildModule;
}

function buildLauncherCSharpSource(): string {
  return `using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

internal static class Program
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll")]
    private static extern bool SetInformationJobObject(IntPtr hJob, int infoType, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public Int64 PerProcessUserTimeLimit;
        public Int64 PerJobUserTimeLimit;
        public UInt32 LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public UInt32 ActiveProcessLimit;
        public UIntPtr Affinity;
        public UInt32 PriorityClass;
        public UInt32 SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS
    {
        public UInt64 ReadOperationCount;
        public UInt64 WriteOperationCount;
        public UInt64 OtherOperationCount;
        public UInt64 ReadTransferCount;
        public UInt64 WriteTransferCount;
        public UInt64 OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    private const int JobObjectExtendedLimitInformation = 9;
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

    private static IntPtr CreateKillOnCloseJob()
    {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) return IntPtr.Zero;

        JOBOBJECT_EXTENDED_LIMIT_INFORMATION info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
        IntPtr ptr = Marshal.AllocHGlobal(length);
        try
        {
            Marshal.StructureToPtr(info, ptr, false);
            SetInformationJobObject(job, JobObjectExtendedLimitInformation, ptr, (uint)length);
        }
        finally
        {
            Marshal.FreeHGlobal(ptr);
        }
        return job;
    }

    private static string QuoteArg(string arg)
    {
        if (string.IsNullOrEmpty(arg)) return "\\"\\"";
        if (arg.IndexOfAny(new char[] { ' ', '\\t', '\\"' }) < 0) return arg;
        StringBuilder sb = new StringBuilder();
        sb.Append('\\"');
        int backslashes = 0;
        foreach (char c in arg)
        {
            if (c == '\\\\')
            {
                backslashes++;
            }
            else if (c == '\\"')
            {
                sb.Append('\\\\', backslashes * 2 + 1);
                sb.Append('\\"');
                backslashes = 0;
            }
            else
            {
                if (backslashes > 0)
                {
                    sb.Append('\\\\', backslashes);
                    backslashes = 0;
                }
                sb.Append(c);
            }
        }
        if (backslashes > 0)
        {
            sb.Append('\\\\', backslashes * 2);
        }
        sb.Append('\\"');
        return sb.ToString();
    }

    private static void EnsureFirewallRuleIfInteractive(string baseDir)
    {
        if (Environment.GetEnvironmentVariable("ASHEN_PACT_NO_OPEN_BROWSER") == "1" ||
            Environment.GetEnvironmentVariable("ASHEN_PACT_NO_FIREWALL_PROMPT") == "1")
        {
            return;
        }

        try
        {
            ProcessStartInfo checkPsi = new ProcessStartInfo();
            checkPsi.FileName = "netsh.exe";
            checkPsi.Arguments = "advfirewall firewall show rule name=\\"Ashen Pact Co-op LAN (TCP 2567-2576)\\"";
            checkPsi.UseShellExecute = false;
            checkPsi.CreateNoWindow = true;
            checkPsi.RedirectStandardOutput = true;
            checkPsi.RedirectStandardError = true;
            using (Process checkProc = Process.Start(checkPsi))
            {
                if (checkProc != null)
                {
                    checkProc.WaitForExit(3000);
                    if (checkProc.ExitCode == 0)
                    {
                        return;
                    }
                }
            }

            string firewallBat = Path.Combine(baseDir, "allow-firewall-port-2567.bat");
            if (!File.Exists(firewallBat)) return;

            Console.WriteLine("[AshenPact-Host] Dang yeu cau quyen Quan tri vien (UAC) de mo cong Windows Firewall TCP 2567-2576 cho mang LAN...");
            ProcessStartInfo elevatePsi = new ProcessStartInfo();
            elevatePsi.FileName = firewallBat;
            elevatePsi.Arguments = "--no-pause --no-elevate";
            elevatePsi.WorkingDirectory = baseDir;
            elevatePsi.UseShellExecute = true;
            elevatePsi.Verb = "runas";
            using (Process elevateProc = Process.Start(elevatePsi))
            {
                if (elevateProc != null)
                {
                    elevateProc.WaitForExit(15000);
                }
            }
        }
        catch
        {
            Console.WriteLine("[AshenPact-Host] Bo qua tu dong mo Firewall. Neu ban be LAN khong ket noi duoc, hay chay allow-firewall-port-2567.bat.");
        }
    }

    public static int Main(string[] args)
    {
        try
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.Title = "Ashen Pact v0.1.0 - Co-op LAN Host Server";
        }
        catch
        {
            // Ignore when stdout is redirected in headless tests
        }

        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string bundledNode = Path.Combine(baseDir, "runtime", "node.exe");
        string nodeExe = File.Exists(bundledNode) ? bundledNode : "node.exe";
        string bundleScript = Path.Combine(baseDir, "server-bundle.cjs");

        if (!File.Exists(bundleScript))
        {
            Console.Error.WriteLine("[AshenPact-Host] Khong tim thay file server-bundle.cjs tai: " + bundleScript);
            return 1;
        }

        EnsureFirewallRuleIfInteractive(baseDir);

        StringBuilder argBuilder = new StringBuilder();
        argBuilder.Append(QuoteArg(bundleScript));
        if (args == null || args.Length == 0)
        {
            argBuilder.Append(" --host");
        }
        else
        {
            for (int i = 0; i < args.Length; i++)
            {
                argBuilder.Append(" ");
                argBuilder.Append(QuoteArg(args[i]));
            }
        }

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = nodeExe;
        psi.Arguments = argBuilder.ToString();
        psi.WorkingDirectory = baseDir;
        psi.UseShellExecute = false;

        IntPtr job = CreateKillOnCloseJob();
        using (Process child = Process.Start(psi))
        {
            if (child == null)
            {
                Console.Error.WriteLine("[AshenPact-Host] Khong the khoi chay runtime node.exe.");
                return 1;
            }

            if (job != IntPtr.Zero)
            {
                AssignProcessToJobObject(job, child.Handle);
            }

            Console.CancelKeyPress += (sender, e) =>
            {
                e.Cancel = true;
                try
                {
                    if (!child.HasExited) child.Kill();
                }
                catch { }
            };

            child.WaitForExit();
            return child.ExitCode;
        }
    }
}
`;
}

function compileHostExecutable(targetExePath: string): void {
  const cscCandidates = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
  ];
  const cscPath = cscCandidates.find((p) => fs.existsSync(p));
  if (!cscPath) {
    throw new Error('Could not find csc.exe on Windows to compile AshenPact-Host.exe');
  }

  const csSourcePath = path.join(RELEASE_ROOT, 'AshenPactHostLauncher.cs');
  fs.writeFileSync(csSourcePath, buildLauncherCSharpSource(), 'utf8');
  try {
    execFileSync(
      cscPath,
      [
        '/nologo',
        '/target:exe',
        '/platform:x64',
        '/optimize+',
        `/out:${targetExePath}`,
        csSourcePath,
      ],
      { stdio: 'pipe' },
    );
  } finally {
    if (fs.existsSync(csSourcePath)) {
      fs.unlinkSync(csSourcePath);
    }
  }
}

function writeBatchScripts(releaseDir: string): void {
  const startHostBat = [
    '@echo off',
    'chcp 65001 >nul',
    'title Ashen Pact v0.1.0 - Co-op LAN Host Server',
    'cd /d "%~dp0"',
    'if exist "%~dp0AshenPact-Host.exe" (',
    '  "%~dp0AshenPact-Host.exe" --host %*',
    ') else (',
    '  "%~dp0runtime\\node.exe" "%~dp0server-bundle.cjs" --host %*',
    ')',
    'if %ERRORLEVEL% neq 0 (',
    '  echo.',
    '  echo [Ashen Pact] May chu da dung voi ma loi %ERRORLEVEL%.',
    '  pause',
    ')',
    '',
  ].join('\r\n');

  const firewallBat = [
    '@echo off',
    'chcp 65001 >nul',
    'title Ashen Pact - Mo Cong Windows Firewall (TCP 2567-2576)',
    'echo ==================================================================',
    'echo   ASHEN PACT v0.1.0 - CAU HINH WINDOWS DEFENDER FIREWALL (LAN)',
    'echo ==================================================================',
    'net session >nul 2>&1',
    'if %ERRORLEVEL% neq 0 (',
    '  if "%1"=="--no-elevate" goto :no_admin',
    '  if "%2"=="--no-elevate" goto :no_admin',
    '  echo [*] Dang yeu cau quyen Quan tri vien ^(UAC^) de mo cong TCP 2567-2576...',
    '  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath \'%~f0\' -ArgumentList \'--no-elevate\' -Verb RunAs"',
    '  exit /b %ERRORLEVEL%',
    ':no_admin',
    '  echo [!] Vui long nhap chuot phai vao file allow-firewall-port-2567.bat',
    '  echo     va chon "Run as administrator" ^(Chay voi quyen Quan tri vien^).',
    '  echo.',
    '  if "%1"=="--no-pause" exit /b 1',
    '  pause',
    '  exit /b 1',
    ')',
    'netsh advfirewall firewall delete rule name="Ashen Pact Co-op LAN (TCP 2567-2576)" >nul 2>&1',
    'netsh advfirewall firewall add rule name="Ashen Pact Co-op LAN (TCP 2567-2576)" dir=in action=allow protocol=TCP localport=2567-2576 profile=private,public',
    'netsh advfirewall firewall add rule name="Ashen Pact Co-op LAN (TCP 2567-2576)" dir=out action=allow protocol=TCP localport=2567-2576 profile=private,public',
    'echo.',
    'echo [OK] Da mo thanh cong cong TCP 2567-2576 tren Windows Firewall!',
    'echo      Bay gio ban be cung mang Wi-Fi / LAN co the tham gia phong choi.',
    'echo ==================================================================',
    'if "%1"=="--no-pause" exit /b 0',
    'pause',
    '',
  ].join('\r\n');

  fs.writeFileSync(path.join(releaseDir, 'start-host.bat'), startHostBat, 'utf8');
  fs.writeFileSync(path.join(releaseDir, 'allow-firewall-port-2567.bat'), firewallBat, 'utf8');
}

export interface PackageReleaseResult {
  releaseDir: string;
  releaseZip: string;
  hostExePath: string;
  startHostBatPath: string;
  firewallBatPath: string;
  serverBundlePath: string;
  clientIndexHtmlPath: string;
}

export function packageRelease(options?: { skipBuild?: boolean; skipZip?: boolean }): PackageReleaseResult {
  const clientDistDir = path.join(ROOT_DIR, 'apps/client/dist');
  if (!options?.skipBuild || !fs.existsSync(path.join(clientDistDir, 'index.html'))) {
    console.log('[package:release] Running production build (pnpm build)...');
    execSync('pnpm build', { cwd: ROOT_DIR, stdio: 'inherit' });
  }

  console.log(`[package:release] Preparing clean release directory: ${RELEASE_DIR}`);
  fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
  fs.mkdirSync(RELEASE_DIR, { recursive: true });

  // 1. Bundle server + shared into a single zero-dependency CJS file
  const serverBundlePath = path.join(RELEASE_DIR, 'server-bundle.cjs');
  console.log('[package:release] Bundling authoritative Colyseus server into server-bundle.cjs...');
  const esbuild = resolveEsbuild();
  esbuild.buildSync({
    entryPoints: [path.join(ROOT_DIR, 'apps/server/src/index.ts')],
    outfile: serverBundlePath,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    sourcemap: false,
    minify: false,
    logLevel: 'warning',
  });

  // 2. Copy static client production build into release/client/
  const releaseClientDir = path.join(RELEASE_DIR, 'client');
  console.log('[package:release] Copying static client production assets...');
  fs.cpSync(clientDistDir, releaseClientDir, { recursive: true });

  // 3. Copy standalone Node.js runtime into release/runtime/node.exe
  const runtimeDir = path.join(RELEASE_DIR, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  const targetNodeExe = path.join(runtimeDir, 'node.exe');
  console.log(`[package:release] Embedding standalone Node runtime (${process.version})...`);
  fs.copyFileSync(process.execPath, targetNodeExe);

  // 4. Compile native Windows x64 launcher AshenPact-Host.exe
  const hostExePath = path.join(RELEASE_DIR, 'AshenPact-Host.exe');
  console.log('[package:release] Compiling native Windows launcher AshenPact-Host.exe...');
  compileHostExecutable(hostExePath);

  // 5. Write start-host.bat & allow-firewall-port-2567.bat
  console.log('[package:release] Writing start-host.bat and allow-firewall-port-2567.bat...');
  writeBatchScripts(RELEASE_DIR);

  // 6. Copy user documentation (README.md, CREDITS.md, RELEASE_NOTES.md)
  for (const [srcRel, destName] of [
    ['README.md', 'README.md'],
    ['CREDITS.md', 'CREDITS.md'],
    ['docs/RELEASE_NOTES.md', 'RELEASE_NOTES.md'],
  ] as const) {
    const srcPath = path.join(ROOT_DIR, srcRel);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(RELEASE_DIR, destName));
    }
  }

  // 7. Create release ZIP archive using .NET ZipFile for fast compression
  if (!options?.skipZip) {
    if (fs.existsSync(RELEASE_ZIP)) {
      fs.unlinkSync(RELEASE_ZIP);
    }
    console.log(`[package:release] Creating archive ${RELEASE_ZIP}...`);
    const psCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${RELEASE_DIR.replace(/'/g, "''")}', '${RELEASE_ZIP.replace(/'/g, "''")}')`;
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
      stdio: 'inherit',
    });
  }

  console.log('==================================================================');
  console.log('  ✅ ĐÓNG GÓI BẢN PHÁT HÀNH HOÀN TẤT (ASHEN PACT v0.1.0 WIN-X64)');
  console.log(`  📁 Thư mục: ${RELEASE_DIR}`);
  console.log(`  📦 File nén: ${RELEASE_ZIP}`);
  console.log(`  🚀 Thực thi: ${hostExePath}`);
  console.log('==================================================================');

  return {
    releaseDir: RELEASE_DIR,
    releaseZip: RELEASE_ZIP,
    hostExePath,
    startHostBatPath: path.join(RELEASE_DIR, 'start-host.bat'),
    firewallBatPath: path.join(RELEASE_DIR, 'allow-firewall-port-2567.bat'),
    serverBundlePath,
    clientIndexHtmlPath: path.join(releaseClientDir, 'index.html'),
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const skipBuild = process.argv.includes('--skip-build');
  const skipZip = process.argv.includes('--skip-zip');
  packageRelease({ skipBuild, skipZip });
}
