#if !NET5_0_OR_GREATER
namespace System.Runtime.CompilerServices
{
    // Lets netstandard2.0 compile `init` accessors and records without a runtime dependency.
    internal static class IsExternalInit
    {
    }
}
#endif

#if !NET7_0_OR_GREATER
namespace System.Runtime.CompilerServices
{
    // Lets netstandard2.0 compile `required` members without a runtime dependency.
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Struct | AttributeTargets.Field | AttributeTargets.Property, AllowMultiple = false, Inherited = false)]
    internal sealed class RequiredMemberAttribute : Attribute
    {
    }

    [AttributeUsage(AttributeTargets.All, AllowMultiple = true, Inherited = false)]
    internal sealed class CompilerFeatureRequiredAttribute : Attribute
    {
        public CompilerFeatureRequiredAttribute(string featureName) => FeatureName = featureName;

        public string FeatureName { get; }

        public bool IsOptional { get; init; }
    }
}

namespace System.Diagnostics.CodeAnalysis
{
    [AttributeUsage(AttributeTargets.Constructor, AllowMultiple = false, Inherited = false)]
    internal sealed class SetsRequiredMembersAttribute : Attribute
    {
    }
}
#endif
