using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using Xunit;

namespace TingQR.Tests
{
    // Like `sync-ts.mjs --check` on the TS side: BankData.g.cs must be what sync-dotnet.mjs generates from
    // conformance/banks/ now.
    public class BankDataSyncTests
    {
        [NodeFact]
        public async Task GeneratedFileIsCurrent()
        {
            var root = Directory.GetParent(ConformanceRoot.Path)!.FullName;
            var script = Path.Combine(ConformanceRoot.Path, "tools", "banks", "sync-dotnet.mjs");
            using var process = NodeFactAttribute.Start(root, "\"" + script + "\" --check");
            var stderr = process.StandardError.ReadToEndAsync();
            var stdout = await process.StandardOutput.ReadToEndAsync();
            process.WaitForExit();
            Assert.True(process.ExitCode == 0, $"sync-dotnet.mjs --check exited {process.ExitCode}: {await stderr}{stdout}");
        }
    }

    /// <summary>
    /// A fact that needs Node. Skipped, with the reason, when <c>node</c> cannot be started (xUnit 2 has no
    /// skipping from inside a test). CI (ci-dotnet.yml) installs Node, so there it always runs. The environment
    /// variable <c>TINGQR_NODE</c> overrides the executable (a name that does not exist shows the skip).
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

        public NodeFactAttribute()
        {
            if (Missing.Value != null)
            {
                Skip = "node is not available, so BankData.g.cs is not checked against conformance/banks/ (" + Missing.Value + ").";
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
