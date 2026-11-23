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
            NodeFactAttribute.EnsureAvailable();
            var root = Directory.GetParent(ConformanceRoot.Path)!.FullName;
            var script = Path.Combine(ConformanceRoot.Path, "tools", "banks", "sync-dotnet.mjs");
            using var process = NodeFactAttribute.Start(root, "\"" + script + "\" --check");
            var stderr = process.StandardError.ReadToEndAsync();
            var stdout = await process.StandardOutput.ReadToEndAsync();
            process.WaitForExit();
            Assert.True(process.ExitCode == 0, $"sync-dotnet.mjs --check exited {process.ExitCode}: {await stderr}{stdout}");
        }

        [Theory]
        [InlineData(null, null, null)]
        [InlineData(null, "true", null)]
        [InlineData("not found", null, "skip")]
        [InlineData("not found", "", "skip")]
        [InlineData("not found", "true", null)]
        [InlineData("not found", "1", null)]
        public void WithoutNodeTheFactSkipsLocallyButRunsAndFailsOnCi(string? missing, string? ci, string? skip)
        {
            Assert.Equal(skip != null, NodeFactAttribute.SkipReason(missing, ci) != null);
            if (missing != null && !string.IsNullOrEmpty(ci))
            {
                Assert.Contains(missing, Assert.ThrowsAny<Exception>(() => NodeFactAttribute.EnsureAvailable(missing, ci)).Message);
            }
            else
            {
                NodeFactAttribute.EnsureAvailable(null, ci);
            }
        }
    }

    /// <summary>
    /// A fact that needs Node. Skipped, with the reason, when <c>node</c> cannot be started (xUnit 2 has no
    /// skipping from inside a test), except when the environment variable <c>CI</c> is set (GitHub Actions sets
    /// it): then the test runs and fails, so a broken Node on CI cannot pass as a skip. Tests call
    /// <see cref="EnsureAvailable()"/> first. The environment variable <c>TINGQR_NODE</c> overrides the executable
    /// (a name that does not exist shows the skip, or the failure with <c>CI</c> set).
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
            Skip = SkipReason(Missing.Value, Ci);
        }

        internal static string? SkipReason(string? missing, string? ci)
            => missing == null || !string.IsNullOrEmpty(ci)
                ? null
                : "node is not available, so BankData.g.cs is not checked against conformance/banks/ (" + missing + ").";

        /// <summary>Fails the test, naming the reason, when Node is missing (reached only with <c>CI</c> set).</summary>
        public static void EnsureAvailable() => EnsureAvailable(Missing.Value, Ci);

        internal static void EnsureAvailable(string? missing, string? ci)
        {
            if (missing != null && !string.IsNullOrEmpty(ci))
            {
                Assert.Fail("CI is set, so a missing node is a failure, not a skip: " + missing);
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
