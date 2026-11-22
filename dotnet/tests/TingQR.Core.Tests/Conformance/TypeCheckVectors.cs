using System.Collections.Generic;

namespace TingQR.Tests.Conformance
{
    /// <summary>
    /// Type-check vectors (conformance/README.md): a field carries a JSON type the C# input type does not declare.
    /// The runner does not call the function for these; it checks that converting <c>input</c> FAILS. Any other
    /// vector whose input fails to convert is a test failure, and so is a listed vector whose input converts.
    /// </summary>
    internal static class TypeCheckVectors
    {
        public static readonly IReadOnlyCollection<string> Ids = new HashSet<string>
        {
            "vietqr-encode-bin-not-string",
            "vietqr-encode-purpose-not-string",
            "number-query",
            "promptpay-encode-two-targets",
        };
    }
}
