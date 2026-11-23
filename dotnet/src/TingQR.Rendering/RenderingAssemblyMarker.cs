using System;

namespace TingQR.Rendering;

/// <summary>Placeholder anchoring the assembly and its reference to TingQR.Core until the renderer lands.</summary>
internal static class RenderingAssemblyMarker
{
    internal static Type CoreErrorType => typeof(TingQrException);
}
