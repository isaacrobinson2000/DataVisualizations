#include <math.h>
#include "../Clock.hpp"
#include <cstddef>
#include <omp.h>

// NOTE: FOR YOUR OWN SAFETY, DO NOT EDIT THIS CODE:
__attribute__((noinline)) void naive_mult(
        double* __restrict C,
        double* __restrict B,
        double* __restrict A,
        const unsigned int N)
{
    for (unsigned int i = 0; i < N; ++i)
        for (unsigned int j = 0; j < N; ++j) {
            C[i * N + j] = 0.0;
            for (unsigned int k = 0; k < N; ++k)
                C[i * N + j] += A[i * N + k] * B[k * N + j];
        }
}
// END NOTE

// Control the size at which we switch to naive matrix multiplication. 
const unsigned int IGNORE_SIZE = 512;
const unsigned int SWITCH_SIZE = 512;

// Move k out for better cache performance, use multithreading...
// This is 10X faster than naive implementation above :)
__attribute__((noinline)) void simple_mult(
    double* __restrict C,
    double* __restrict B,
    double* __restrict A,
    const unsigned int N
) {
    // Zero all values...
    #pragma omp parallel for
    for (unsigned int i = 0; i < N; ++i) {
        for (unsigned int j = 0; j < N; ++j) {
            C[i * N + j] = 0.0;
        }
    }
    
    // We iterate over the columns in the outermost loop to avoid cache misses.
    // This iterates over 3 matrix rows k times, so were computing cell partials at each step.
    for (unsigned int k = 0; k < N; ++k) {
        #pragma omp parallel for
        for (unsigned int i = 0; i < N; ++i) {
            for (unsigned int j = 0; j < N; ++j) {
                C[i * N + j] += A[i * N + k] * B[k * N + j];
            }
        }
    }
}

// Add, subtract, and copy routines, all parallel. We use if constexpr to avoid lots of code duplication.
template<bool NEGATE_SECOND_ARG = false, bool ZERO_SECOND_ARG = false>
__attribute__((noinline)) void combine(
    double* __restrict A,
    double* __restrict B,
    double* __restrict C,
    const unsigned int N
) {
    size_t length = (size_t)N * N;
    #pragma omp parallel for
    for(size_t i = 0; i < length; i++) {
        if constexpr(ZERO_SECOND_ARG) {
            C[i] = A[i];
        }
        else if constexpr(NEGATE_SECOND_ARG) {
            C[i] = A[i] - B[i];
        }
        else {
            C[i] = A[i] + B[i];
        }
    }
}

__attribute__((noinline)) void add(
    double* __restrict A,
    double* __restrict B,
    double* __restrict C,
    const unsigned int N
) {
    combine<false, false>(A, B, C, N);
}

__attribute__((noinline)) void sub(
    double* __restrict A,
    double* __restrict B,
    double* __restrict C,
    const unsigned int N
) {
    combine<true, false>(A, B, C, N);
}


__attribute__((noinline)) void dec(
    double* __restrict A,
    double* __restrict B,
    const unsigned int N
) {
    sub(A, B, A, N);
}

__attribute__((noinline)) void inc(
    double* __restrict A,
    double* __restrict B,
    const unsigned int N
) {
    add(A, B, A, N);
}

__attribute__((noinline)) void copy(
    double* __restrict SRC,
    double* __restrict DEST,
    const unsigned int N
) {
    combine<false, true>(SRC, nullptr, DEST, N);
}

// Converts 1 matrix into 4 flat arrays being it's quadrants. Calling it with REVERSE=true reverses the process...
template<bool REVERSE = false>
void splitter(    
    double* __restrict M,
    double* __restrict TEMP,
    const unsigned int N
) {
    unsigned int half = N >> 1;
    
    for(unsigned int qi = 0; qi < N; qi += half) {
        for(unsigned int qj = 0; qj < N; qj += half) {
            #pragma omp parallel for
            for(unsigned int i = 0; i < half; i++) {
                
                unsigned int flatIdx = (N * qi) + (N >> 1) * qj + (N >> 1) * i;
                
                for(unsigned int j = 0; j < half; j++) {
                    unsigned int quadIndex = (qi * N + qj) + (i * N + j);
                    
                    if constexpr(REVERSE) {
                        TEMP[quadIndex] = M[flatIdx];
                    } 
                    else {
                        TEMP[flatIdx] = M[quadIndex];
                    }
                    flatIdx++;
                }
            }
        }
    }
    
    size_t length = (size_t)N * N;
    #pragma omp parallel for
    for(unsigned int i = 0; i < length; i++) M[i] = TEMP[i];
}

// Macro that defines variables for all of the quadrants...
#define quadrants(M, length) double* __restrict M ## 11 = M; \
                             double* __restrict M ## 12 = M + (length / 4); \
                             double* __restrict M ## 21 = M + (length / 2); \
                             double* __restrict M ## 22 = M + (3 * length / 4);

void strassen(    
    double* __restrict A,
    double* __restrict B,
    double* __restrict C,
    double* __restrict TEMP,
    const unsigned int N
) {
    if(N <= SWITCH_SIZE) {
        simple_mult(C, B, A, N);
        return;
    }
    
    // Seperate into the 4 quadrants...
    splitter<false>(A, TEMP, N);
    splitter<false>(B, TEMP, N);
    
    const unsigned int halfN = N >> 1;
    const size_t length = (size_t)N * N;
    // Setup variables pointing to all 4 quadrants...
    quadrants(A, length);
    quadrants(B, length);
    quadrants(C, length);
    quadrants(TEMP, length);
    
    // Compute and copy M1 to its needed locations...
    add(A11, A22, TEMP11, halfN);
    add(B11, B22, TEMP12, halfN);
    strassen(TEMP11, TEMP12, TEMP21, TEMP22, halfN);
    copy(TEMP21, C11, halfN);
    copy(TEMP21, C22, halfN);
    
    // Compute and copy M2 to it's respective locations...
    add(A21, A22, TEMP11, halfN);
    strassen(TEMP11, B11, TEMP21, TEMP22, halfN);
    copy(TEMP21, C21, halfN);
    dec(C22, TEMP21, halfN);
    
    // Compute and copy M3 to it's respective locations...
    sub(B12, B22, TEMP12, halfN);
    strassen(A11, TEMP12, TEMP21, TEMP22, halfN);
    copy(TEMP21, C12, halfN);
    inc(C22, TEMP21, halfN);
    
    // Compute and copy M4 to it's locations...
    sub(B21, B11, TEMP12, halfN);
    strassen(A22, TEMP12, TEMP21, TEMP22, halfN);
    inc(C11, TEMP21, halfN);
    inc(C21, TEMP21, halfN);
    
    // Compute and copy M5...
    add(A11, A12, TEMP11, halfN);
    strassen(TEMP11, B22, TEMP21, TEMP22, halfN);
    dec(C11, TEMP21, halfN);
    inc(C12, TEMP21, halfN);
    
    // Compute and copy M6...
    sub(A21, A11, TEMP11, halfN);
    add(B11, B12, TEMP12, halfN);
    strassen(TEMP11, TEMP12, TEMP21, TEMP22, halfN);
    inc(C22, TEMP21, halfN);
    
    // Compute and copy M7...
    sub(A12, A22, TEMP11, halfN);
    add(B21, B22, TEMP12, halfN);
    strassen(TEMP11, TEMP12, TEMP21, TEMP22, halfN);
    inc(C11, TEMP21, halfN);
    
    // Parial C maticies done, now recombine them (and A and B since they might be being used.)
    splitter<true>(A, TEMP, N);
    splitter<true>(B, TEMP, N);
    splitter<true>(C, TEMP, N);
    
    // Solution is now in C...
}

// Transpose a square matrix in place...
__attribute__((noinline)) void mult(
    double* __restrict C,
    double* __restrict B,
    double* __restrict A,
    const unsigned int N
) {
    if(N <= IGNORE_SIZE) {
         simple_mult(C, B, A, N);
         return;
    }
    double* buffer = new double[N * N];
    strassen(A, B, C, buffer, N);
    delete[] buffer;
}

// NOTE: FOR YOUR OWN SAFETY, DO NOT EDIT THIS CODE:
int main(int argc, char** argv)
{
    if (argc != 3)
        std::cerr << "usage: <log_problem_size> <seed>" << std::endl;
    else {
        const unsigned LOG_N = atoi(argv[1]);
        const unsigned long N = 1ul << LOG_N;
        const unsigned seed = atoi(argv[2]);
        srand(seed);

        double* A = new double[N * N];
        double* B = new double[N * N];

        for (unsigned long i = 0; i < N * N; ++i)
            A[i] = (rand() % 1000) / 999.0;
        for (unsigned long i = 0; i < N * N; ++i)
            B[i] = (rand() % 1000) / 999.0;

        double* C = new double[N * N];

        Clock c;
        mult(C, B, A, N);
        float mult_time = c.tock();

        double* C_naive = new double[N * N];
        c.tick();
        naive_mult(C_naive, B, A, N);
        float naive_mult_time = c.tock();

        double max_l1_error = 0.0;
        for (unsigned long i = 0; i < N * N; ++i)
            max_l1_error = std::max(max_l1_error, fabs(C_naive[i] - C[i]));
        std::cout << "Numeric error: " << max_l1_error << std::endl;

        float speedup = naive_mult_time / mult_time;
        std::cout << "Speedup: " << speedup << std::endl;

        std::cout << std::endl;

        // Verify numeric error:
        bool pass = true;
        if (max_l1_error >= 1e-4) {
            std::cerr << "FAIL: Numeric error is too high" << std::endl;
            pass = false;
        } else
            std::cout << "PASS: Numeric error" << std::endl;

        // Verify speedup:
        if (speedup < 5) {
            std::cerr << "FAIL: Speedup is too low" << std::endl;
            pass = false;
        } else
            std::cout << "PASS: Speedup" << std::endl;

        if (pass)
            std::cout << "OVERALL PASS" << std::endl;
        else {
            std::cout << "OVERALL FAIL" << std::endl;
            exit(1);
        }
    }

    return 0;
}
