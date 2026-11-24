using System.Reflection;
using Xunit;

namespace TingQR.Tests
{
    // One Version lives in Directory.Build.props; the constant must follow it (set-version.mjs edits both).
    public class VersionTests
    {
        [Fact]
        public void Constant_matches_assembly_informational_version() =>
            Assert.StartsWith(TingQrVersion.Value,
                typeof(TingQrVersion).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()!.InformationalVersion);
    }
}
