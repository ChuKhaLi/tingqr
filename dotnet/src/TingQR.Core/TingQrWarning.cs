namespace TingQR
{
    /// <summary>A non-fatal finding while reading a payload.</summary>
    /// <param name="Code">The warning code.</param>
    /// <param name="Message">Human-readable message.</param>
    /// <param name="Tag">The tag concerned, if any.</param>
    public sealed record TingQrWarning(TingQrWarningCode Code, string Message, string? Tag = null);
}
