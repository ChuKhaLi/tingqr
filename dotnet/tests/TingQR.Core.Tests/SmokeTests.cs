using System.IO;
using System.Text.RegularExpressions;
using Xunit;

namespace TingQR.Tests;

public class SmokeTests
{
    [Fact]
    public void VersionMatchesTypeScript()
    {
        var file = Path.Combine(ConformanceRoot.Path, "..", "ts", "packages", "core", "src", "index.ts");
        var m = Regex.Match(File.ReadAllText(file), "export const VERSION = '([^']*)'");
        Assert.True(m.Success);
        Assert.Equal(TingQrVersion.Value, m.Groups[1].Value);
    }

    [Fact]
    public void ConformanceRootFindsErrorsJson()
    {
        Assert.True(File.Exists(Path.Combine(ConformanceRoot.Path, "errors.json")));
    }
}
