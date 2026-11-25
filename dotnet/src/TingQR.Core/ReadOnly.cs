using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;

namespace TingQR
{
    /// <summary>
    /// Read-only wrappers, so a list or dictionary the library returns cannot be changed by casting it back to
    /// <see cref="IList{T}"/> or <see cref="IDictionary{TKey,TValue}"/>. Lists are copied first (they may come from the
    /// caller); dictionaries are wrapped as they are, so pass only a dictionary nobody else holds.
    /// </summary>
    internal static class ReadOnly
    {
        public static IReadOnlyList<T> List<T>(IEnumerable<T> items) => new ReadOnlyCollection<T>(items.ToList());

        public static IReadOnlyList<T>? ListOrNull<T>(IEnumerable<T>? items) => items == null ? null : List(items);

        public static IReadOnlyDictionary<string, string> Dictionary(IDictionary<string, string> items)
            => new ReadOnlyDictionary<string, string>(items);
    }
}
