using System.Reflection;
using Xunit;

namespace TingQR.Tests
{
    // One Version lives in Directory.Build.props; the constant must follow it (set-version.mjs edits both).
    public class VersionTests
    {
        [Fact]
        public void Constant_equals_assembly_informational_version_without_build_metadata()
        {
            // The SDK appends "+<commit>" (source link) to the informational version; the rest must equal the constant
            // exactly, so a truncated constant ("0.0", "") fails too.
            var informational = typeof(TingQrVersion).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()!.InformationalVersion;
            var plus = informational.IndexOf('+');
            Assert.Equal(TingQrVersion.Value, plus < 0 ? informational : informational.Substring(0, plus));
        }
    }
}
