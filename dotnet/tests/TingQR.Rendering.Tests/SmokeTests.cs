using System;
using System.IO;
using System.Linq;
using Xunit;

namespace TingQR.Rendering.Tests;

public class SmokeTests
{
    [Fact]
    public void ConformanceRootFindsRenderVectors()
    {
        var files = Directory.GetFiles(Path.Combine(ConformanceRoot.Path, "vectors", "render"), "*.json");
        Assert.True(files.Length >= 27, "found " + files.Length);
    }

    [Fact]
    public void RenderingAssemblyReferencesCore()
    {
        var assembly = typeof(RenderingAssemblyMarker).Assembly;
        Assert.Equal("TingQR.Rendering", assembly.GetName().Name);
        Assert.Contains(assembly.GetReferencedAssemblies(), a => a.Name == "TingQR.Core");
    }
}
