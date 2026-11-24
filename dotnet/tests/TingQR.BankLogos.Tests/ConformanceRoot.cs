namespace TingQR.Tests;

internal static class ConformanceRoot
{
    /// <summary>The repo's <c>conformance/</c> directory, found by walking up from the test binary.</summary>
    public static string Path { get; } = Find();

    private static string Find()
    {
        var dir = new System.IO.DirectoryInfo(System.AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = System.IO.Path.Combine(dir.FullName, "conformance");
            if (System.IO.File.Exists(System.IO.Path.Combine(candidate, "errors.json")))
            {
                return candidate;
            }
            dir = dir.Parent;
        }
        throw new System.InvalidOperationException("conformance/errors.json not found above " + System.AppContext.BaseDirectory);
    }
}
