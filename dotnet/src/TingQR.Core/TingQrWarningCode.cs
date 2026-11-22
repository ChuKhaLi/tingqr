namespace TingQR
{
    /// <summary>Warning codes shared with the TypeScript implementation.</summary>
    public enum TingQrWarningCode
    {
        /// <summary>Whitespace around the payload was removed.</summary>
        TrimmedWhitespace,
        /// <summary>A commonly omitted tag is missing; a default was used.</summary>
        MissingOptionalTag,
        /// <summary>The CRC is written in lowercase hex.</summary>
        LowercaseCrc,
    }
}
