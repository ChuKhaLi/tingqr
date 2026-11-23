using System;
using System.Collections.Generic;
using TingQR.Emv;

namespace TingQR
{
    /// <summary>Thrown when a QR payload cannot be built or read.</summary>
    public sealed class TingQrException : Exception
    {
        /// <summary>The error code.</summary>
        public TingQrErrorCode Code { get; }

        /// <summary>The tag the error relates to, if any.</summary>
        public string? Tag { get; }

        /// <summary>Fields parsed before the error, if known.</summary>
        public IReadOnlyList<TlvNode>? Fields { get; }

        /// <summary>Creates the exception.</summary>
        public TingQrException(TingQrErrorCode code, string message, string? tag = null, IReadOnlyList<TlvNode>? fields = null)
            : base(message)
        {
            Code = code;
            Tag = tag;
            Fields = fields;
        }
    }
}
