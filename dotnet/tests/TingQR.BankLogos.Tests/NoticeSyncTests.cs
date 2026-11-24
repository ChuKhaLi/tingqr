using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using Xunit;

namespace TingQR.Tests
{
    // LOGOS-NOTICE.md of the NuGet package must be what gen.mjs generates from conformance/banks/logos/ now.
    public class NoticeSyncTests
    {
        [NodeFact]
        public async Task NoticeIsCurrent()
        {
            NodeFactAttribute.EnsureAvailable();
            var root = Directory.GetParent(ConformanceRoot.Path)!.FullName;
            var script = Path.Combine(root, "ts", "packages", "bank-logos", "scripts", "gen.mjs");
            using var process = NodeFactAttribute.Start(root, "\"" + script + "\" --check-notice");
            var stderr = process.StandardError.ReadToEndAsync();
            var stdout = await process.StandardOutput.ReadToEndAsync();
            process.WaitForExit();
            Assert.True(process.ExitCode == 0, $"gen.mjs --check-notice exited {process.ExitCode}: {await stderr}{stdout}");
        }
    }

    /// <summary>
    /// A fact that needs Node: skipped, with the reason, when <c>node</c> cannot be started, except when the
    /// environment variable <c>CI</c> is set: then it runs and fails. Same approach as BankDataSyncTests in Core.Tests.
    /// </summary>
    internal sealed class NodeFactAttribute : FactAttribute
    {
        private static readonly string Node = Environment.GetEnvironmentVariable("TINGQR_NODE") ?? "node";

        private static readonly Lazy<string?> Missing = new Lazy<string?>(() =>
        {
            try
            {
                using var p = Start(Directory.GetCurrentDirectory(), "--version");
                p.StandardOutput.ReadToEnd();
                p.WaitForExit();
                return p.ExitCode == 0 ? null : $"{Node} --version exited {p.ExitCode}";
            }
            catch (Win32Exception e)
            {
                return e.Message;
            }
        });

        private static string? Ci => Environment.GetEnvironmentVariable("CI");

        public NodeFactAttribute()
        {
            if (Missing.Value != null && string.IsNullOrEmpty(Ci))
            {
                Skip = "node is not available, so LOGOS-NOTICE.md is not checked against conformance/banks/logos/ (" + Missing.Value + ").";
            }
        }

        public static void EnsureAvailable()
        {
            if (Missing.Value != null && !string.IsNullOrEmpty(Ci))
            {
                Assert.Fail("CI is set, so a missing node is a failure, not a skip: " + Missing.Value);
            }
        }

        public static Process Start(string workingDirectory, string arguments)
            => Process.Start(new ProcessStartInfo(Node, arguments)
            {
                WorkingDirectory = workingDirectory,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            })!;
    }
}
