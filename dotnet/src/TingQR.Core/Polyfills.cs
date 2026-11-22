#if !NET5_0_OR_GREATER
namespace System.Runtime.CompilerServices
{
    // Lets netstandard2.0 compile `init` accessors and records without a runtime dependency.
    internal static class IsExternalInit
    {
    }
}
#endif
