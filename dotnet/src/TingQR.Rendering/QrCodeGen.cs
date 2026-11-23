/*
 * QR Code generator library (TypeScript)
 *
 * Copyright (c) Project Nayuki. (MIT License)
 * https://www.nayuki.io/page/qr-code-generator-library
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   liability, whether in an action of contract, tort or otherwise, arising from,
 *   out of or in connection with the Software or the use or other dealings in the
 *   Software.
 */

/*
 * [tingqr] Ported from Project Nayuki's QR Code generator, TypeScript version:
 *   https://github.com/nayuki/QR-Code-generator/blob/v1.8.0/typescript-javascript/qrcodegen.ts
 *   tag v1.8.0, commit 720f62bddb7226106071d4728c292cb1df519ceb,
 *   SHA-256 of the original file c4749095a91bf9696e3a303998b9905e467094f53041e64393e65e6d887737fd
 *   (vendored unmodified at conformance/tools/oracle/vendor/nayuki-qrcodegen-v1.8.0.ts),
 *   by way of tingqr's TypeScript copy ts/packages/render/src/qrcodegen.ts.
 *
 * Changes of tingqr's TypeScript copy (see the list at the top of that file), and what each became here:
 *   1. The tingqr comment block: this comment block.
 *   2. `namespace qrcodegen` removed: the classes live in the C# namespace TingQR.Rendering.
 *   3. `export namespace QrCode` / `QrSegment` (merged with the classes): QrCode.Ecc and QrSegment.Mode are nested
 *      classes, declared at the end of the file in a second `partial` part of each class to keep the original order.
 *   4. `QrSegment.…` references without the `qrcodegen.` prefix: the same here.
 *   5. `// @ts-nocheck`: not needed; this file compiles under the repo's C# settings (Nullable, warnings as errors).
 *   6. The licence header opening with `/*!`: C# has no such convention; the header above is the original text.
 *
 * Changes made by the translation to C#. Everything else is the TypeScript, function by function, in the same order:
 *   a. Everything is `internal`. Names are PascalCase (encodeText → EncodeText, MIN_VERSION → MinVersion, …); private
 *      fields keep their TypeScript names.
 *   b. `bit`, `byte` and `int` are C# `int`; `Array<…>` is List<…> (or an array for the constant tables).
 *      All shifts here have non-negative operands below 2^31, so C# `>>>` and `<<` give JavaScript's 32-bit results.
 *      `Math.floor(a / b)` on non-negative ints is C# integer division; `Math.ceil` keeps a double division.
 *   c. JavaScript's RangeError is the internal exception RangeError below; the generic Error of `assert` and of the
 *      unreachable mask case is InvalidOperationException.
 *   d. QrSegment.getTotalBits returns a double, so it can still return Infinity (double.PositiveInfinity).
 *   e. isNumeric and isAlphanumeric test each UTF-16 code unit against ASCII '0'–'9' and ALPHANUMERIC_CHARSET instead of
 *      NUMERIC_REGEX and ALPHANUMERIC_REGEX (the sets are the same; .NET `\d` would also match non-ASCII digits).
 *      The two regex constants are therefore gone.
 *   f. toUtf8ByteArray uses a strict UTF8Encoding instead of encodeURI + percent decoding: the same bytes for every
 *      well-formed string, and both throw on a lone surrogate (TingQrRender.ToMatrix rejects those first).
 *   g. parseInt(…, 10) on 1–3 ASCII digits is int.Parse with NumberStyles.None and the invariant culture.
 *   h. The free functions appendBits, getBit and assert are in the static class QrCodeGen, imported with `using static`.
 *   i. Where C# has no direct equivalent, a line marked "[C#]" says what the TypeScript was: array methods (slice via the
 *      helper Slice, concat, shift, pop, unshift, map, reduce, forEach), the second `dataCapacityBits` in
 *      encodeSegments (renamed dataCapacityBits2: C# forbids reusing a name from an inner scope), the field
 *      QrSegment.mode (Mode_, since a member cannot share the nested class Mode's name), and constructor parameter
 *      properties (explicit fields assigned first, as TypeScript does).
 * No algorithm, name or constant was changed. Matrix vectors from the original encoder (conformance/vectors/render/)
 * prove the port.
 */

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using static TingQR.Rendering.QrCodeGen;

namespace TingQR.Rendering
{

	/*---- QR Code symbol class ----*/

	/*
	 * A QR Code symbol, which is a type of two-dimension barcode.
	 * Invented by Denso Wave and described in the ISO/IEC 18004 standard.
	 * Instances of this class represent an immutable square grid of dark and light cells.
	 * The class provides static factory functions to create a QR Code from text or binary data.
	 * The class covers the QR Code Model 2 specification, supporting all versions (sizes)
	 * from 1 to 40, all 4 error correction levels, and 4 character encoding modes.
	 *
	 * Ways to create a QR Code object:
	 * - High level: Take the payload data and call QrCode.encodeText() or QrCode.encodeBinary().
	 * - Mid level: Custom-make the list of segments and call QrCode.encodeSegments().
	 * - Low level: Custom-make the array of data codeword bytes (including
	 *   segment headers and final padding, excluding error correction codewords),
	 *   supply the appropriate version number, and call the QrCode() constructor.
	 * (Note that all ways require supplying the desired error correction level.)
	 */
	internal sealed partial class QrCode {

		/*-- Static factory functions (high level) --*/

		// Returns a QR Code representing the given Unicode text string at the given error correction level.
		// As a conservative upper bound, this function is guaranteed to succeed for strings that have 738 or fewer
		// Unicode code points (not UTF-16 code units) if the low error correction level is used. The smallest possible
		// QR Code version is automatically chosen for the output. The ECC level of the result may be higher than the
		// ecl argument if it can be done without increasing the version.
		internal static QrCode EncodeText(string text, QrCode.Ecc ecl) {
			List<QrSegment> segs = QrSegment.MakeSegments(text);
			return QrCode.EncodeSegments(segs, ecl);
		}


		// Returns a QR Code representing the given binary data at the given error correction level.
		// This function always encodes using the binary segment mode, not any text mode. The maximum number of
		// bytes allowed is 2953. The smallest possible QR Code version is automatically chosen for the output.
		// The ECC level of the result may be higher than the ecl argument if it can be done without increasing the version.
		internal static QrCode EncodeBinary(IReadOnlyList<int> data, QrCode.Ecc ecl) {
			QrSegment seg = QrSegment.MakeBytes(data);
			return QrCode.EncodeSegments(new List<QrSegment> { seg }, ecl);
		}


		/*-- Static factory functions (mid level) --*/

		// Returns a QR Code representing the given segments with the given encoding parameters.
		// The smallest possible QR Code version within the given range is automatically
		// chosen for the output. Iff boostEcl is true, then the ECC level of the result
		// may be higher than the ecl argument if it can be done without increasing the
		// version. The mask number is either between 0 to 7 (inclusive) to force that
		// mask, or -1 to automatically choose an appropriate mask (which may be slow).
		// This function allows the user to create a custom sequence of segments that switches
		// between modes (such as alphanumeric and byte) to encode text in less space.
		// This is a mid-level API; the high-level API is encodeText() and encodeBinary().
		internal static QrCode EncodeSegments(IReadOnlyList<QrSegment> segs, QrCode.Ecc ecl,
				int minVersion = 1, int maxVersion = 40,
				int mask = -1, bool boostEcl = true) {

			if (!(QrCode.MinVersion <= minVersion && minVersion <= maxVersion && maxVersion <= QrCode.MaxVersion)
					|| mask < -1 || mask > 7)
				throw new RangeError("Invalid value");

			// Find the minimal version number to use
			int version;
			int dataUsedBits;
			for (version = minVersion; ; version++) {
				int dataCapacityBits = QrCode.GetNumDataCodewords(version, ecl) * 8;  // Number of data bits available
				double usedBits = QrSegment.GetTotalBits(segs, version);
				if (usedBits <= dataCapacityBits) {
					dataUsedBits = (int)usedBits;
					break;  // This version number is found to be suitable
				}
				if (version >= maxVersion)  // All versions in the range could not fit the given data
					throw new RangeError("Data too long");
			}

			// Increase the error correction level while the data still fits in the current version number
			foreach (QrCode.Ecc newEcl in new[] { QrCode.Ecc.MEDIUM, QrCode.Ecc.QUARTILE, QrCode.Ecc.HIGH }) {  // From low to high
				if (boostEcl && dataUsedBits <= QrCode.GetNumDataCodewords(version, newEcl) * 8)
					ecl = newEcl;
			}

			// Concatenate all segments to create the data bit string
			List<int> bb = new List<int>();
			foreach (QrSegment seg in segs) {
				AppendBits(seg.Mode_.ModeBits, 4, bb);
				AppendBits(seg.NumChars, seg.Mode_.NumCharCountBits(version), bb);
				foreach (int b in seg.GetData())
					bb.Add(b);
			}
			Assert(bb.Count == dataUsedBits);

			// Add terminator and pad up to a byte if applicable
			int dataCapacityBits2 = QrCode.GetNumDataCodewords(version, ecl) * 8;  // [C#] named dataCapacityBits in TS
			Assert(bb.Count <= dataCapacityBits2);
			AppendBits(0, Math.Min(4, dataCapacityBits2 - bb.Count), bb);
			AppendBits(0, (8 - bb.Count % 8) % 8, bb);
			Assert(bb.Count % 8 == 0);

			// Pad with alternating bytes until data capacity is reached
			for (int padByte = 0xEC; bb.Count < dataCapacityBits2; padByte ^= 0xEC ^ 0x11)
				AppendBits(padByte, 8, bb);

			// Pack bits into bytes in big endian
			List<int> dataCodewords = new List<int>();
			while (dataCodewords.Count * 8 < bb.Count)
				dataCodewords.Add(0);
			for (int i = 0; i < bb.Count; i++)
				dataCodewords[i >>> 3] |= bb[i] << (7 - (i & 7));

			// Create the QR Code object
			return new QrCode(version, ecl, dataCodewords, mask);
		}


		/*-- Fields --*/

		// The width and height of this QR Code, measured in modules, between
		// 21 and 177 (inclusive). This is equal to version * 4 + 17.
		internal readonly int Size;

		// The index of the mask pattern used in this QR Code, which is between 0 and 7 (inclusive).
		// Even if a QR Code is created with automatic masking requested (mask = -1),
		// the resulting object still has a mask value between 0 and 7.
		internal readonly int Mask;

		// The modules of this QR Code (false = light, true = dark).
		// Immutable after constructor finishes. Accessed through getModule().
		private readonly List<List<bool>> modules    = new List<List<bool>>();

		// Indicates function modules that are not subjected to masking. Discarded when constructor finishes.
		private readonly List<List<bool>> isFunction = new List<List<bool>>();


		/*-- Constructor (low level) and fields --*/

		// The version number of this QR Code, which is between 1 and 40 (inclusive).
		// This determines the size of this barcode.
		internal readonly int Version;

		// The error correction level used in this QR Code.
		internal readonly QrCode.Ecc ErrorCorrectionLevel;

		// Creates a new QR Code with the given version number,
		// error correction level, data codeword bytes, and mask number.
		// This is a low-level API that most users should not use directly.
		// A mid-level API is the encodeSegments() function.
		internal QrCode(
				int version,

				QrCode.Ecc errorCorrectionLevel,

				IReadOnlyList<int> dataCodewords,

				int msk) {
			this.Version = version;
			this.ErrorCorrectionLevel = errorCorrectionLevel;

			// Check scalar arguments
			if (version < QrCode.MinVersion || version > QrCode.MaxVersion)
				throw new RangeError("Version value out of range");
			if (msk < -1 || msk > 7)
				throw new RangeError("Mask value out of range");
			this.Size = version * 4 + 17;

			// Initialize both grids to be size*size arrays of Boolean false
			List<bool> row = new List<bool>();
			for (int i = 0; i < this.Size; i++)
				row.Add(false);
			for (int i = 0; i < this.Size; i++) {
				this.modules   .Add(new List<bool>(row));  // Initially all light
				this.isFunction.Add(new List<bool>(row));
			}

			// Compute ECC, draw modules
			this.DrawFunctionPatterns();
			List<int> allCodewords = this.AddEccAndInterleave(dataCodewords);
			this.DrawCodewords(allCodewords);

			// Do masking
			if (msk == -1) {  // Automatically choose best mask
				int minPenalty = 1000000000;
				for (int i = 0; i < 8; i++) {
					this.ApplyMask(i);
					this.DrawFormatBits(i);
					int penalty = this.GetPenaltyScore();
					if (penalty < minPenalty) {
						msk = i;
						minPenalty = penalty;
					}
					this.ApplyMask(i);  // Undoes the mask due to XOR
				}
			}
			Assert(0 <= msk && msk <= 7);
			this.Mask = msk;
			this.ApplyMask(msk);  // Apply the final choice of mask
			this.DrawFormatBits(msk);  // Overwrite old format bits

			this.isFunction = new List<List<bool>>();
		}


		/*-- Accessor methods --*/

		// Returns the color of the module (pixel) at the given coordinates, which is false
		// for light or true for dark. The top left corner has the coordinates (x=0, y=0).
		// If the given coordinates are out of bounds, then false (light) is returned.
		internal bool GetModule(int x, int y) {
			return 0 <= x && x < this.Size && 0 <= y && y < this.Size && this.modules[y][x];
		}


		/*-- Private helper methods for constructor: Drawing function modules --*/

		// Reads this object's version field, and draws and marks all function modules.
		private void DrawFunctionPatterns() {
			// Draw horizontal and vertical timing patterns
			for (int i = 0; i < this.Size; i++) {
				this.SetFunctionModule(6, i, i % 2 == 0);
				this.SetFunctionModule(i, 6, i % 2 == 0);
			}

			// Draw 3 finder patterns (all corners except bottom right; overwrites some timing modules)
			this.DrawFinderPattern(3, 3);
			this.DrawFinderPattern(this.Size - 4, 3);
			this.DrawFinderPattern(3, this.Size - 4);

			// Draw numerous alignment patterns
			List<int> alignPatPos = this.GetAlignmentPatternPositions();
			int numAlign = alignPatPos.Count;
			for (int i = 0; i < numAlign; i++) {
				for (int j = 0; j < numAlign; j++) {
					// Don't draw on the three finder corners
					if (!(i == 0 && j == 0 || i == 0 && j == numAlign - 1 || i == numAlign - 1 && j == 0))
						this.DrawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
				}
			}

			// Draw configuration data
			this.DrawFormatBits(0);  // Dummy mask value; overwritten later in the constructor
			this.DrawVersion();
		}


		// Draws two copies of the format bits (with its own error correction code)
		// based on the given mask and this object's error correction level field.
		private void DrawFormatBits(int mask) {
			// Calculate error correction code and pack bits
			int data = this.ErrorCorrectionLevel.FormatBits << 3 | mask;  // errCorrLvl is uint2, mask is uint3
			int rem = data;
			for (int i = 0; i < 10; i++)
				rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
			int bits = (data << 10 | rem) ^ 0x5412;  // uint15
			Assert(bits >>> 15 == 0);

			// Draw first copy
			for (int i = 0; i <= 5; i++)
				this.SetFunctionModule(8, i, GetBit(bits, i));
			this.SetFunctionModule(8, 7, GetBit(bits, 6));
			this.SetFunctionModule(8, 8, GetBit(bits, 7));
			this.SetFunctionModule(7, 8, GetBit(bits, 8));
			for (int i = 9; i < 15; i++)
				this.SetFunctionModule(14 - i, 8, GetBit(bits, i));

			// Draw second copy
			for (int i = 0; i < 8; i++)
				this.SetFunctionModule(this.Size - 1 - i, 8, GetBit(bits, i));
			for (int i = 8; i < 15; i++)
				this.SetFunctionModule(8, this.Size - 15 + i, GetBit(bits, i));
			this.SetFunctionModule(8, this.Size - 8, true);  // Always dark
		}


		// Draws two copies of the version bits (with its own error correction code),
		// based on this object's version field, iff 7 <= version <= 40.
		private void DrawVersion() {
			if (this.Version < 7)
				return;

			// Calculate error correction code and pack bits
			int rem = this.Version;  // version is uint6, in the range [7, 40]
			for (int i = 0; i < 12; i++)
				rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
			int bits = this.Version << 12 | rem;  // uint18
			Assert(bits >>> 18 == 0);

			// Draw two copies
			for (int i = 0; i < 18; i++) {
				bool color = GetBit(bits, i);
				int a = this.Size - 11 + i % 3;
				int b = i / 3;
				this.SetFunctionModule(a, b, color);
				this.SetFunctionModule(b, a, color);
			}
		}


		// Draws a 9*9 finder pattern including the border separator,
		// with the center module at (x, y). Modules can be out of bounds.
		private void DrawFinderPattern(int x, int y) {
			for (int dy = -4; dy <= 4; dy++) {
				for (int dx = -4; dx <= 4; dx++) {
					int dist = Math.Max(Math.Abs(dx), Math.Abs(dy));  // Chebyshev/infinity norm
					int xx = x + dx;
					int yy = y + dy;
					if (0 <= xx && xx < this.Size && 0 <= yy && yy < this.Size)
						this.SetFunctionModule(xx, yy, dist != 2 && dist != 4);
				}
			}
		}


		// Draws a 5*5 alignment pattern, with the center module
		// at (x, y). All modules must be in bounds.
		private void DrawAlignmentPattern(int x, int y) {
			for (int dy = -2; dy <= 2; dy++) {
				for (int dx = -2; dx <= 2; dx++)
					this.SetFunctionModule(x + dx, y + dy, Math.Max(Math.Abs(dx), Math.Abs(dy)) != 1);
			}
		}


		// Sets the color of a module and marks it as a function module.
		// Only used by the constructor. Coordinates must be in bounds.
		private void SetFunctionModule(int x, int y, bool isDark) {
			this.modules[y][x] = isDark;
			this.isFunction[y][x] = true;
		}


		/*-- Private helper methods for constructor: Codewords and masking --*/

		// Returns a new byte string representing the given data with the appropriate error correction
		// codewords appended to it, based on this object's version and error correction level.
		private List<int> AddEccAndInterleave(IReadOnlyList<int> data) {
			int ver = this.Version;
			QrCode.Ecc ecl = this.ErrorCorrectionLevel;
			if (data.Count != QrCode.GetNumDataCodewords(ver, ecl))
				throw new RangeError("Invalid argument");

			// Calculate parameter numbers
			int numBlocks = QrCode.NumErrorCorrectionBlocks[ecl.Ordinal][ver];
			int blockEccLen = QrCode.EccCodewordsPerBlock   [ecl.Ordinal][ver];
			int rawCodewords = QrCode.GetNumRawDataModules(ver) / 8;
			int numShortBlocks = numBlocks - rawCodewords % numBlocks;
			int shortBlockLen = rawCodewords / numBlocks;

			// Split data into blocks and append ECC to each block
			List<List<int>> blocks = new List<List<int>>();
			List<int> rsDiv = QrCode.ReedSolomonComputeDivisor(blockEccLen);
			for (int i = 0, k = 0; i < numBlocks; i++) {
				List<int> dat = Slice(data, k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
				k += dat.Count;
				List<int> ecc = QrCode.ReedSolomonComputeRemainder(dat, rsDiv);
				if (i < numShortBlocks)
					dat.Add(0);
				dat.AddRange(ecc);  // [C#] TS: blocks.push(dat.concat(ecc))
				blocks.Add(dat);
			}

			// Interleave (not concatenate) the bytes from every block into a single sequence
			List<int> result = new List<int>();
			for (int i = 0; i < blocks[0].Count; i++) {
				for (int j = 0; j < blocks.Count; j++) {
					List<int> block = blocks[j];
					// Skip the padding byte in short blocks
					if (i != shortBlockLen - blockEccLen || j >= numShortBlocks)
						result.Add(block[i]);
				}
			}
			Assert(result.Count == rawCodewords);
			return result;
		}


		// Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
		// data area of this QR Code. Function modules need to be marked off before this is called.
		private void DrawCodewords(IReadOnlyList<int> data) {
			if (data.Count != QrCode.GetNumRawDataModules(this.Version) / 8)
				throw new RangeError("Invalid argument");
			int i = 0;  // Bit index into the data
			// Do the funny zigzag scan
			for (int right = this.Size - 1; right >= 1; right -= 2) {  // Index of right column in each column pair
				if (right == 6)
					right = 5;
				for (int vert = 0; vert < this.Size; vert++) {  // Vertical counter
					for (int j = 0; j < 2; j++) {
						int x = right - j;  // Actual x coordinate
						bool upward = ((right + 1) & 2) == 0;
						int y = upward ? this.Size - 1 - vert : vert;  // Actual y coordinate
						if (!this.isFunction[y][x] && i < data.Count * 8) {
							this.modules[y][x] = GetBit(data[i >>> 3], 7 - (i & 7));
							i++;
						}
						// If this QR Code has any remainder bits (0 to 7), they were assigned as
						// 0/false/light by the constructor and are left unchanged by this method
					}
				}
			}
			Assert(i == data.Count * 8);
		}


		// XORs the codeword modules in this QR Code with the given mask pattern.
		// The function modules must be marked and the codeword bits must be drawn
		// before masking. Due to the arithmetic of XOR, calling applyMask() with
		// the same mask value a second time will undo the mask. A final well-formed
		// QR Code needs exactly one (not zero, two, etc.) mask applied.
		private void ApplyMask(int mask) {
			if (mask < 0 || mask > 7)
				throw new RangeError("Mask value out of range");
			for (int y = 0; y < this.Size; y++) {
				for (int x = 0; x < this.Size; x++) {
					bool invert;
					switch (mask) {
						case 0:  invert = (x + y) % 2 == 0;                                  break;
						case 1:  invert = y % 2 == 0;                                        break;
						case 2:  invert = x % 3 == 0;                                        break;
						case 3:  invert = (x + y) % 3 == 0;                                  break;
						case 4:  invert = (x / 3 + y / 2) % 2 == 0;                          break;
						case 5:  invert = x * y % 2 + x * y % 3 == 0;                        break;
						case 6:  invert = (x * y % 2 + x * y % 3) % 2 == 0;                  break;
						case 7:  invert = ((x + y) % 2 + x * y % 3) % 2 == 0;                break;
						default:  throw new InvalidOperationException("Unreachable");
					}
					if (!this.isFunction[y][x] && invert)
						this.modules[y][x] = !this.modules[y][x];
				}
			}
		}


		// Calculates and returns the penalty score based on state of this QR Code's current modules.
		// This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
		private int GetPenaltyScore() {
			int result = 0;

			// Adjacent modules in row having same color, and finder-like patterns
			for (int y = 0; y < this.Size; y++) {
				bool runColor = false;
				int runX = 0;
				List<int> runHistory = new List<int> { 0,0,0,0,0,0,0 };
				for (int x = 0; x < this.Size; x++) {
					if (this.modules[y][x] == runColor) {
						runX++;
						if (runX == 5)
							result += QrCode.PenaltyN1;
						else if (runX > 5)
							result++;
					} else {
						this.FinderPenaltyAddHistory(runX, runHistory);
						if (!runColor)
							result += this.FinderPenaltyCountPatterns(runHistory) * QrCode.PenaltyN3;
						runColor = this.modules[y][x];
						runX = 1;
					}
				}
				result += this.FinderPenaltyTerminateAndCount(runColor, runX, runHistory) * QrCode.PenaltyN3;
			}
			// Adjacent modules in column having same color, and finder-like patterns
			for (int x = 0; x < this.Size; x++) {
				bool runColor = false;
				int runY = 0;
				List<int> runHistory = new List<int> { 0,0,0,0,0,0,0 };
				for (int y = 0; y < this.Size; y++) {
					if (this.modules[y][x] == runColor) {
						runY++;
						if (runY == 5)
							result += QrCode.PenaltyN1;
						else if (runY > 5)
							result++;
					} else {
						this.FinderPenaltyAddHistory(runY, runHistory);
						if (!runColor)
							result += this.FinderPenaltyCountPatterns(runHistory) * QrCode.PenaltyN3;
						runColor = this.modules[y][x];
						runY = 1;
					}
				}
				result += this.FinderPenaltyTerminateAndCount(runColor, runY, runHistory) * QrCode.PenaltyN3;
			}

			// 2*2 blocks of modules having same color
			for (int y = 0; y < this.Size - 1; y++) {
				for (int x = 0; x < this.Size - 1; x++) {
					bool color = this.modules[y][x];
					if (  color == this.modules[y][x + 1] &&
					      color == this.modules[y + 1][x] &&
					      color == this.modules[y + 1][x + 1])
						result += QrCode.PenaltyN2;
				}
			}

			// Balance of dark and light modules
			int dark = 0;
			foreach (List<bool> row in this.modules) {
				foreach (bool color in row)  // [C#] TS: row.reduce((sum, color) => sum + (color ? 1 : 0), dark)
					dark += color ? 1 : 0;
			}
			int total = this.Size * this.Size;  // Note that size is odd, so dark/total != 1/2
			// Compute the smallest integer k >= 0 such that (45-5k)% <= dark/total <= (55+5k)%
			int k = (int)Math.Ceiling(Math.Abs(dark * 20 - total * 10) / (double)total) - 1;
			Assert(0 <= k && k <= 9);
			result += k * QrCode.PenaltyN4;
			Assert(0 <= result && result <= 2568888);  // Non-tight upper bound based on default values of PENALTY_N1, ..., N4
			return result;
		}


		/*-- Private helper functions --*/

		// Returns an ascending list of positions of alignment patterns for this version number.
		// Each position is in the range [0,177), and are used on both the x and y axes.
		// This could be implemented as lookup table of 40 variable-length lists of integers.
		private List<int> GetAlignmentPatternPositions() {
			if (this.Version == 1)
				return new List<int>();
			else {
				int numAlign = this.Version / 7 + 2;
				int step = (this.Version == 32) ? 26 :
					(int)Math.Ceiling((this.Version * 4 + 4) / (double)(numAlign * 2 - 2)) * 2;
				List<int> result = new List<int> { 6 };
				for (int pos = this.Size - 7; result.Count < numAlign; pos -= step)
					result.Insert(1, pos);
				return result;
			}
		}


		// Returns the number of data bits that can be stored in a QR Code of the given version number, after
		// all function modules are excluded. This includes remainder bits, so it might not be a multiple of 8.
		// The result is in the range [208, 29648]. This could be implemented as a 40-entry lookup table.
		private static int GetNumRawDataModules(int ver) {
			if (ver < QrCode.MinVersion || ver > QrCode.MaxVersion)
				throw new RangeError("Version number out of range");
			int result = (16 * ver + 128) * ver + 64;
			if (ver >= 2) {
				int numAlign = ver / 7 + 2;
				result -= (25 * numAlign - 10) * numAlign - 55;
				if (ver >= 7)
					result -= 36;
			}
			Assert(208 <= result && result <= 29648);
			return result;
		}


		// Returns the number of 8-bit data (i.e. not error correction) codewords contained in any
		// QR Code of the given version number and error correction level, with remainder bits discarded.
		// This stateless pure function could be implemented as a (40*4)-cell lookup table.
		private static int GetNumDataCodewords(int ver, QrCode.Ecc ecl) {
			return QrCode.GetNumRawDataModules(ver) / 8 -
				QrCode.EccCodewordsPerBlock    [ecl.Ordinal][ver] *
				QrCode.NumErrorCorrectionBlocks[ecl.Ordinal][ver];
		}


		// Returns a Reed-Solomon ECC generator polynomial for the given degree. This could be
		// implemented as a lookup table over all possible parameter values, instead of as an algorithm.
		private static List<int> ReedSolomonComputeDivisor(int degree) {
			if (degree < 1 || degree > 255)
				throw new RangeError("Degree out of range");
			// Polynomial coefficients are stored from highest to lowest power, excluding the leading term which is always 1.
			// For example the polynomial x^3 + 255x^2 + 8x + 93 is stored as the uint8 array [255, 8, 93].
			List<int> result = new List<int>();
			for (int i = 0; i < degree - 1; i++)
				result.Add(0);
			result.Add(1);  // Start off with the monomial x^0

			// Compute the product polynomial (x - r^0) * (x - r^1) * (x - r^2) * ... * (x - r^{degree-1}),
			// and drop the highest monomial term which is always 1x^degree.
			// Note that r = 0x02, which is a generator element of this field GF(2^8/0x11D).
			int root = 1;
			for (int i = 0; i < degree; i++) {
				// Multiply the current product by (x - r^i)
				for (int j = 0; j < result.Count; j++) {
					result[j] = QrCode.ReedSolomonMultiply(result[j], root);
					if (j + 1 < result.Count)
						result[j] ^= result[j + 1];
				}
				root = QrCode.ReedSolomonMultiply(root, 0x02);
			}
			return result;
		}


		// Returns the Reed-Solomon error correction codeword for the given data and divisor polynomials.
		private static List<int> ReedSolomonComputeRemainder(IReadOnlyList<int> data, IReadOnlyList<int> divisor) {
			List<int> result = new List<int>();  // [C#] TS: divisor.map(_ => 0)
			for (int i = 0; i < divisor.Count; i++)
				result.Add(0);
			foreach (int b in data) {  // Polynomial division
				int factor = b ^ result[0];  // [C#] TS: result.shift()
				result.RemoveAt(0);
				result.Add(0);
				for (int i = 0; i < divisor.Count; i++)
					result[i] ^= QrCode.ReedSolomonMultiply(divisor[i], factor);
			}
			return result;
		}


		// Returns the product of the two given field elements modulo GF(2^8/0x11D). The arguments and result
		// are unsigned 8-bit integers. This could be implemented as a lookup table of 256*256 entries of uint8.
		private static int ReedSolomonMultiply(int x, int y) {
			if (x >>> 8 != 0 || y >>> 8 != 0)
				throw new RangeError("Byte out of range");
			// Russian peasant multiplication
			int z = 0;
			for (int i = 7; i >= 0; i--) {
				z = (z << 1) ^ ((z >>> 7) * 0x11D);
				z ^= ((y >>> i) & 1) * x;
			}
			Assert(z >>> 8 == 0);
			return z;
		}


		// Can only be called immediately after a light run is added, and
		// returns either 0, 1, or 2. A helper function for getPenaltyScore().
		private int FinderPenaltyCountPatterns(IReadOnlyList<int> runHistory) {
			int n = runHistory[1];
			Assert(n <= this.Size * 3);
			bool core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
			return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0)
			     + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
		}


		// Must be called at the end of a line (row or column) of modules. A helper function for getPenaltyScore().
		private int FinderPenaltyTerminateAndCount(bool currentRunColor, int currentRunLength, List<int> runHistory) {
			if (currentRunColor) {  // Terminate dark run
				this.FinderPenaltyAddHistory(currentRunLength, runHistory);
				currentRunLength = 0;
			}
			currentRunLength += this.Size;  // Add light border to final run
			this.FinderPenaltyAddHistory(currentRunLength, runHistory);
			return this.FinderPenaltyCountPatterns(runHistory);
		}


		// Pushes the given value to the front and drops the last value. A helper function for getPenaltyScore().
		private void FinderPenaltyAddHistory(int currentRunLength, List<int> runHistory) {
			if (runHistory[0] == 0)
				currentRunLength += this.Size;  // Add light border to initial run
			runHistory.RemoveAt(runHistory.Count - 1);  // [C#] TS: runHistory.pop()
			runHistory.Insert(0, currentRunLength);  // [C#] TS: runHistory.unshift(currentRunLength)
		}


		/*-- Constants and tables --*/

		// The minimum version number supported in the QR Code Model 2 standard.
		internal const int MinVersion =  1;
		// The maximum version number supported in the QR Code Model 2 standard.
		internal const int MaxVersion = 40;

		// For use in getPenaltyScore(), when evaluating which mask is best.
		private const int PenaltyN1 =  3;
		private const int PenaltyN2 =  3;
		private const int PenaltyN3 = 40;
		private const int PenaltyN4 = 10;

		private static readonly int[][] EccCodewordsPerBlock = {
			// Version: (note that index 0 is for padding, and is set to an illegal value)
			//          0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
			new int[] {-1,  7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30},  // Low
			new int[] {-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28},  // Medium
			new int[] {-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30},  // Quartile
			new int[] {-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30},  // High
		};

		private static readonly int[][] NumErrorCorrectionBlocks = {
			// Version: (note that index 0 is for padding, and is set to an illegal value)
			//          0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
			new int[] {-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4,  4,  4,  4,  4,  6,  6,  6,  6,  7,  8,  8,  9,  9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25},  // Low
			new int[] {-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5,  5,  8,  9,  9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49},  // Medium
			new int[] {-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8,  8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68},  // Quartile
			new int[] {-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81},  // High
		};


		// [C#] JavaScript's Array.prototype.slice(start, end) on a list, end clamped to the length.
		private static List<int> Slice(IReadOnlyList<int> list, int start, int end) {
			List<int> result = new List<int>();
			for (int i = start; i < end && i < list.Count; i++)
				result.Add(list[i]);
			return result;
		}

	}


	internal static class QrCodeGen {  // [C#] the free functions of the TypeScript module

		// Appends the given number of low-order bits of the given value
		// to the given buffer. Requires 0 <= len <= 31 and 0 <= val < 2^len.
		internal static void AppendBits(int val, int len, List<int> bb) {
			if (len < 0 || len > 31 || val >>> len != 0)
				throw new RangeError("Value out of range");
			for (int i = len - 1; i >= 0; i--)  // Append bit by bit
				bb.Add((val >>> i) & 1);
		}


		// Returns true iff the i'th bit of x is set to 1.
		internal static bool GetBit(int x, int i) {
			return ((x >>> i) & 1) != 0;
		}


		// Throws an exception if the given condition is false.
		internal static void Assert(bool cond) {
			if (!cond)
				throw new InvalidOperationException("Assertion error");
		}

	}


	// [C#] JavaScript's RangeError, which TingQrRender.ToMatrix maps to "too long" exactly as matrix.ts does.
	internal sealed class RangeError : Exception {
		internal RangeError(string message) : base(message) {}
	}



	/*---- Data segment class ----*/

	/*
	 * A segment of character/binary/control data in a QR Code symbol.
	 * Instances of this class are immutable.
	 * The mid-level way to create a segment is to take the payload data
	 * and call a static factory function such as QrSegment.makeNumeric().
	 * The low-level way to create a segment is to custom-make the bit buffer
	 * and call the QrSegment() constructor with appropriate values.
	 * This segment class imposes no length restrictions, but QR Codes have restrictions.
	 * Even in the most favorable conditions, a QR Code can only hold 7089 characters of data.
	 * Any segment longer than this is meaningless for the purpose of generating QR Codes.
	 */
	internal sealed partial class QrSegment {

		/*-- Static factory functions (mid level) --*/

		// Returns a segment representing the given binary data encoded in
		// byte mode. All input byte arrays are acceptable. Any text string
		// can be converted to UTF-8 bytes and encoded as a byte mode segment.
		internal static QrSegment MakeBytes(IReadOnlyList<int> data) {
			List<int> bb = new List<int>();
			foreach (int b in data)
				AppendBits(b, 8, bb);
			return new QrSegment(QrSegment.Mode.BYTE, data.Count, bb);
		}


		// Returns a segment representing the given string of decimal digits encoded in numeric mode.
		internal static QrSegment MakeNumeric(string digits) {
			if (!QrSegment.IsNumeric(digits))
				throw new RangeError("String contains non-numeric characters");
			List<int> bb = new List<int>();
			for (int i = 0; i < digits.Length; ) {  // Consume up to 3 digits per iteration
				int n = Math.Min(digits.Length - i, 3);
				AppendBits(int.Parse(digits.Substring(i, n), NumberStyles.None, CultureInfo.InvariantCulture), n * 3 + 1, bb);
				i += n;
			}
			return new QrSegment(QrSegment.Mode.NUMERIC, digits.Length, bb);
		}


		// Returns a segment representing the given text string encoded in alphanumeric mode.
		// The characters allowed are: 0 to 9, A to Z (uppercase only), space,
		// dollar, percent, asterisk, plus, hyphen, period, slash, colon.
		internal static QrSegment MakeAlphanumeric(string text) {
			if (!QrSegment.IsAlphanumeric(text))
				throw new RangeError("String contains unencodable characters in alphanumeric mode");
			List<int> bb = new List<int>();
			int i;
			for (i = 0; i + 2 <= text.Length; i += 2) {  // Process groups of 2
				int temp = QrSegment.AlphanumericCharset.IndexOf(text[i]) * 45;
				temp += QrSegment.AlphanumericCharset.IndexOf(text[i + 1]);
				AppendBits(temp, 11, bb);
			}
			if (i < text.Length)  // 1 character remaining
				AppendBits(QrSegment.AlphanumericCharset.IndexOf(text[i]), 6, bb);
			return new QrSegment(QrSegment.Mode.ALPHANUMERIC, text.Length, bb);
		}


		// Returns a new mutable list of zero or more segments to represent the given Unicode text string.
		// The result may use various segment modes and switch modes to optimize the length of the bit stream.
		internal static List<QrSegment> MakeSegments(string text) {
			// Select the most efficient segment encoding automatically
			if (text == "")
				return new List<QrSegment>();
			else if (QrSegment.IsNumeric(text))
				return new List<QrSegment> { QrSegment.MakeNumeric(text) };
			else if (QrSegment.IsAlphanumeric(text))
				return new List<QrSegment> { QrSegment.MakeAlphanumeric(text) };
			else
				return new List<QrSegment> { QrSegment.MakeBytes(QrSegment.ToUtf8ByteArray(text)) };
		}


		// Returns a segment representing an Extended Channel Interpretation
		// (ECI) designator with the given assignment value.
		internal static QrSegment MakeEci(int assignVal) {
			List<int> bb = new List<int>();
			if (assignVal < 0)
				throw new RangeError("ECI assignment value out of range");
			else if (assignVal < (1 << 7))
				AppendBits(assignVal, 8, bb);
			else if (assignVal < (1 << 14)) {
				AppendBits(0b10, 2, bb);
				AppendBits(assignVal, 14, bb);
			} else if (assignVal < 1000000) {
				AppendBits(0b110, 3, bb);
				AppendBits(assignVal, 21, bb);
			} else
				throw new RangeError("ECI assignment value out of range");
			return new QrSegment(QrSegment.Mode.ECI, 0, bb);
		}


		// Tests whether the given string can be encoded as a segment in numeric mode.
		// A string is encodable iff each character is in the range 0 to 9.
		internal static bool IsNumeric(string text) {
			foreach (char c in text) {  // [C#] TS: NUMERIC_REGEX.test(text), /^[0-9]*$/
				if (c < '0' || c > '9')
					return false;
			}
			return true;
		}


		// Tests whether the given string can be encoded as a segment in alphanumeric mode.
		// A string is encodable iff each character is in the following set: 0 to 9, A to Z
		// (uppercase only), space, dollar, percent, asterisk, plus, hyphen, period, slash, colon.
		internal static bool IsAlphanumeric(string text) {
			foreach (char c in text) {  // [C#] TS: ALPHANUMERIC_REGEX.test(text), /^[A-Z0-9 $%*+.\/:-]*$/
				if (QrSegment.AlphanumericCharset.IndexOf(c) == -1)
					return false;
			}
			return true;
		}


		/*-- Constructor (low level) and fields --*/

		// The mode indicator of this segment.
		internal readonly QrSegment.Mode Mode_;  // [C#] TS: mode (a C# member cannot share the nested class's name)

		// The length of this segment's unencoded data. Measured in characters for
		// numeric/alphanumeric/kanji mode, bytes for byte mode, and 0 for ECI mode.
		// Always zero or positive. Not the same as the data's bit length.
		internal readonly int NumChars;

		// The data bits of this segment. Accessed through getData().
		private readonly List<int> bitData;

		// Creates a new QR Code segment with the given attributes and data.
		// The character count (numChars) must agree with the mode and the bit buffer length,
		// but the constraint isn't checked. The given bit buffer is cloned and stored.
		internal QrSegment(
				QrSegment.Mode mode,

				int numChars,

				IReadOnlyList<int> bitData) {
			this.Mode_ = mode;
			this.NumChars = numChars;

			if (numChars < 0)
				throw new RangeError("Invalid argument");
			this.bitData = new List<int>(bitData);  // Make defensive copy
		}


		/*-- Methods --*/

		// Returns a new copy of the data bits of this segment.
		internal List<int> GetData() {
			return new List<int>(this.bitData);  // Make defensive copy
		}


		// (Package-private) Calculates and returns the number of bits needed to encode the given segments at
		// the given version. The result is infinity if a segment has too many characters to fit its length field.
		internal static double GetTotalBits(IReadOnlyList<QrSegment> segs, int version) {
			double result = 0;
			foreach (QrSegment seg in segs) {
				int ccbits = seg.Mode_.NumCharCountBits(version);
				if (seg.NumChars >= (1 << ccbits))
					return double.PositiveInfinity;  // The segment's length doesn't fit the field's bit width
				result += 4 + ccbits + seg.bitData.Count;
			}
			return result;
		}


		// Returns a new array of bytes representing the given string encoded in UTF-8.
		private static List<int> ToUtf8ByteArray(string str) {
			// [C#] TS: encodeURI(str), then each "%XX" as a byte and each other character as its code
			byte[] bytes = new UTF8Encoding(false, true).GetBytes(str);
			List<int> result = new List<int>();
			foreach (byte b in bytes)
				result.Add(b);
			return result;
		}


		/*-- Constants --*/

		// [C#] NUMERIC_REGEX and ALPHANUMERIC_REGEX are replaced by the loops in IsNumeric and IsAlphanumeric.

		// The set of all legal characters in alphanumeric mode,
		// where each character value maps to the index in the string.
		private const string AlphanumericCharset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

	}



	/*---- Public helper enumeration ----*/

	internal sealed partial class QrCode {  // [C#] TS: export namespace QrCode { (tingqr change 3)

		/*
		 * The error correction level in a QR Code symbol. Immutable.
		 */
		internal sealed class Ecc {

			/*-- Constants --*/

			internal static readonly Ecc LOW      = new Ecc(0, 1);  // The QR Code can tolerate about  7% erroneous codewords
			internal static readonly Ecc MEDIUM   = new Ecc(1, 0);  // The QR Code can tolerate about 15% erroneous codewords
			internal static readonly Ecc QUARTILE = new Ecc(2, 3);  // The QR Code can tolerate about 25% erroneous codewords
			internal static readonly Ecc HIGH     = new Ecc(3, 2);  // The QR Code can tolerate about 30% erroneous codewords


			/*-- Constructor and fields --*/

			// In the range 0 to 3 (unsigned 2-bit integer).
			internal readonly int Ordinal;
			// (Package-private) In the range 0 to 3 (unsigned 2-bit integer).
			internal readonly int FormatBits;

			private Ecc(int ordinal, int formatBits) {
				this.Ordinal = ordinal;
				this.FormatBits = formatBits;
			}

		}
	}



	/*---- Public helper enumeration ----*/

	internal sealed partial class QrSegment {  // [C#] TS: export namespace QrSegment { (tingqr change 3)

		/*
		 * Describes how a segment's data bits are interpreted. Immutable.
		 */
		internal sealed class Mode {

			/*-- Constants --*/

			internal static readonly Mode NUMERIC      = new Mode(0x1, new[] {10, 12, 14});
			internal static readonly Mode ALPHANUMERIC = new Mode(0x2, new[] { 9, 11, 13});
			internal static readonly Mode BYTE         = new Mode(0x4, new[] { 8, 16, 16});
			internal static readonly Mode KANJI        = new Mode(0x8, new[] { 8, 10, 12});
			internal static readonly Mode ECI          = new Mode(0x7, new[] { 0,  0,  0});


			/*-- Constructor and fields --*/

			// The mode indicator bits, which is a uint4 value (range 0 to 15).
			internal readonly int ModeBits;
			// Number of character count bits for three different version ranges.
			private readonly int[] numBitsCharCount;

			private Mode(int modeBits, int[] numBitsCharCount) {
				this.ModeBits = modeBits;
				this.numBitsCharCount = numBitsCharCount;
			}


			/*-- Method --*/

			// (Package-private) Returns the bit width of the character count field for a segment in
			// this mode in a QR Code at the given version number. The result is in the range [0, 16].
			internal int NumCharCountBits(int ver) {
				return this.numBitsCharCount[(ver + 7) / 17];
			}

		}
	}
}
