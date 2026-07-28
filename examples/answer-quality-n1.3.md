# Contoh Jawaban N1.3

## Contoh rumus — turunan polinomial

**Pertanyaan:** Cari turunan dari f(x) = x³ + 2x² − 5x + 7.

Diketahui:
- f(x) = x³ + 2x² − 5x + 7

Konsep/Rumus yang digunakan:
- d/dx(axⁿ) = a·n·xⁿ⁻¹
- Turunan konstanta = 0

Penyelesaian:
- d/dx(x³) = 3x²
- d/dx(2x²) = 4x
- d/dx(−5x) = −5
- d/dx(7) = 0

Jawaban akhir:

[ f'(x) = 3x² + 4x − 5 ]

Penjelasan singkat:
Setiap pangkat dikalikan dengan koefisien, lalu pangkat dikurangi satu. Konstanta hilang karena turunannya nol.

## Contoh coding — bilangan prima Python

Tujuan:
Program membaca sebuah bilangan bulat lalu menentukan apakah bilangan tersebut prima.

```python
angka = int(input("Masukkan angka: "))

if angka <= 1:
    print("Bukan bilangan prima")
else:
    prima = True

    for i in range(2, int(angka ** 0.5) + 1):
        if angka % i == 0:
            prima = False
            break

    if prima:
        print("Bilangan prima")
    else:
        print("Bukan bilangan prima")
```

Cara kerja:
1. Bilangan 1, 0, dan bilangan negatif langsung dinyatakan bukan prima.
2. Pemeriksaan pembagi cukup sampai √angka karena faktor selalu muncul berpasangan.
3. Ketika pembagi ditemukan, loop dihentikan agar lebih efisien.

Contoh input/output:

```text
Masukkan angka: 17
Bilangan prima
```

Kompleksitas waktu: O(√n).
