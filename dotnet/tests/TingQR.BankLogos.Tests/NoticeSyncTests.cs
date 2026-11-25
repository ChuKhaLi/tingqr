using System;
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
}
