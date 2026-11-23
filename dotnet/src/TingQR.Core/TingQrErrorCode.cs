namespace TingQR
{
    /// <summary>Error codes shared with the TypeScript implementation (see <c>conformance/errors.json</c>).</summary>
    public enum TingQrErrorCode
    {
        /// <summary>The payload has no CRC field.</summary>
        CrcMissing,
        /// <summary>The CRC does not match the payload.</summary>
        CrcMismatch,
        /// <summary>A tag is not two decimal digits.</summary>
        BadTag,
        /// <summary>A field length is not two decimal digits.</summary>
        BadLength,
        /// <summary>A field length runs past the end of the payload.</summary>
        Truncated,
        /// <summary>A field value is longer than 99 characters.</summary>
        FieldTooLong,
        /// <summary>The value contains characters outside printable ASCII.</summary>
        NonAscii,
        /// <summary>A tag appears more than once at the same level.</summary>
        DuplicateTag,
        /// <summary>A required tag is missing.</summary>
        MissingTag,
        /// <summary>A value does not match the format the scheme requires.</summary>
        InvalidValue,
        /// <summary>The payload belongs to a different scheme than expected.</summary>
        UnsupportedScheme,
        /// <summary>No supported scheme recognises the payload.</summary>
        UnknownScheme,
        /// <summary>The logo image could not be loaded (browser rendering only; never thrown by .NET).</summary>
        LogoLoadFailed,
        /// <summary>The canvas is tainted (browser rendering only; never thrown by .NET).</summary>
        CanvasTainted,
        /// <summary>No usable canvas (browser rendering only; never thrown by .NET).</summary>
        NoCanvas,
    }
}
