using System;
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
}
