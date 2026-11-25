using System.Collections.Generic;

namespace TingQR
{
    /// <summary>Outcome of a non-throwing read: a value with warnings, or an error.</summary>
    /// <typeparam name="T">Value type.</typeparam>
    public sealed class TingQrResult<T>
    {
        private TingQrResult(bool ok, T? value, IReadOnlyList<TingQrWarning> warnings, TingQrException? error)
        {
            Ok = ok;
            Value = value;
            Warnings = ReadOnly.List(warnings);
            Error = error;
        }

        /// <summary>True when reading succeeded.</summary>
        public bool Ok { get; }

        /// <summary>The value; default when <see cref="Ok"/> is false.</summary>
        public T? Value { get; }

        /// <summary>Warnings raised on success; empty on failure. Read-only.</summary>
        public IReadOnlyList<TingQrWarning> Warnings { get; }

        /// <summary>The error; null when <see cref="Ok"/> is true.</summary>
        public TingQrException? Error { get; }

        /// <summary>
        /// Builds a successful result. <paramref name="warnings"/> is copied: later changes to the caller's list are not
        /// seen, and <see cref="Warnings"/> is read-only.
        /// </summary>
        public static TingQrResult<T> Success(T value, IReadOnlyList<TingQrWarning> warnings)
            => new TingQrResult<T>(true, value, warnings, null);

        /// <summary>Builds a failed result.</summary>
        public static TingQrResult<T> Failure(TingQrException error)
            => new TingQrResult<T>(false, default, new TingQrWarning[0], error);
    }
}
