import path from "path";
import {fileURLToPath} from "url";
import process from "process";
import fs from "fs-extra";
import {customCmakeOptionsEnvVarPrefix, llamaCppDirectory, llamaDirectory} from "../config.js";
import {clearLlamaBuild} from "./clearLlamaBuild.js";
import {setUsedBinFlag} from "./usedBinFlag.js";
import {spawnCommand} from "./spawnCommand.js";
import {fixXpackPermissions, getCmakePath, hasBuiltinCmake} from "./cmake.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function compileLlamaCpp({
    arch = process.arch, nodeTarget = process.version, setUsedBinFlag: setUsedBinFlagArg = true, metal = process.platform === "darwin",
    cuda = false
}: {
    arch?: string, nodeTarget?: string, setUsedBinFlag?: boolean, metal?: boolean, cuda?: boolean
}) {
    try {
        if (!(await fs.pathExists(llamaCppDirectory))) {
            throw new Error(`"${llamaCppDirectory}" directory does not exist`);
        }

        const cmakePathArgs = await getCmakePathArgs();
        const runtimeVersion = nodeTarget.startsWith("v") ? nodeTarget.slice("v".length) : nodeTarget;
        const cmakeCustomOptions = [];

        if ((metal && process.platform === "darwin") || process.env.LLAMA_METAL === "1") cmakeCustomOptions.push("LLAMA_METAL=1");
        else cmakeCustomOptions.push("LLAMA_METAL=0");

        if (cuda || process.env.LLAMA_CUBLAS === "1") cmakeCustomOptions.push("LLAMA_CUBLAS=1");
        if (process.env.LLAMA_MPI === "1") cmakeCustomOptions.push("LLAMA_MPI=1");
        if (process.env.LLAMA_OPENBLAS === "1") cmakeCustomOptions.push("LLAMA_OPENBLAS=1");
        if (process.env.LLAMA_BLAS_VENDOR != null) cmakeCustomOptions.push("LLAMA_BLAS_VENDOR=" + process.env.LLAMA_BLAS_VENDOR);
        if (process.env.LLAMA_CUDA_FORCE_DMMV != null) cmakeCustomOptions.push("LLAMA_CUDA_FORCE_DMMV=" + process.env.LLAMA_CUDA_FORCE_DMMV);
        if (process.env.LLAMA_CUDA_DMMV_X != null) cmakeCustomOptions.push("LLAMA_CUDA_DMMV_X=" + process.env.LLAMA_CUDA_DMMV_X);
        if (process.env.LLAMA_CUDA_MMV_Y != null) cmakeCustomOptions.push("LLAMA_CUDA_MMV_Y=" + process.env.LLAMA_CUDA_MMV_Y);
        if (process.env.LLAMA_CUDA_F16 != null) cmakeCustomOptions.push("LLAMA_CUDA_F16=" + process.env.LLAMA_CUDA_F16);
        if (process.env.LLAMA_CUDA_KQUANTS_ITER != null) cmakeCustomOptions.push("LLAMA_CUDA_KQUANTS_ITER=" + process.env.LLAMA_CUDA_KQUANTS_ITER);
        if (process.env.LLAMA_HIPBLAS === "1") cmakeCustomOptions.push("LLAMA_HIPBLAS=1");
        if (process.env.LLAMA_CLBLAST === "1") cmakeCustomOptions.push("LLAMA_CLBLAST=1");

        for (const key in process.env) {
            if (key.startsWith(customCmakeOptionsEnvVarPrefix)) {
                const option = key.slice(customCmakeOptionsEnvVarPrefix.length);
                const value = process.env[key];
                cmakeCustomOptions.push(`${option}=${value}`);
            }
        }

        await clearLlamaBuild();

        await spawnCommand("npm", ["run", "-s", "cmake-js-llama", "--", "clean", "--log-level", "warn", ...cmakePathArgs], __dirname);

        await spawnCommand(
            "npm",
            ["run", "-s", "cmake-js-llama", "--", "compile", "--log-level", "warn", "--arch=" + arch, "--runtime-version=" + runtimeVersion, ...cmakePathArgs]
                .concat(cmakeCustomOptions.map(option => "--CD" + option)),
            __dirname
        );

        const binFilesDirPath = path.join(llamaDirectory, "build", "llama.cpp", "bin");
        const compiledResultDirPath = await getCompiledResultDir();

        if (await fs.pathExists(binFilesDirPath)) {
            const files = await fs.readdir(binFilesDirPath);

            await Promise.all(
                files.map((fileName) => (
                    fs.copy(path.join(binFilesDirPath, fileName), path.join(compiledResultDirPath, fileName), {
                        overwrite: false
                    })
                ))
            );
        }

        if (setUsedBinFlagArg) {
            await setUsedBinFlag("localBuildFromSource");
        }
    } catch (err) {
        if (setUsedBinFlagArg)
            await setUsedBinFlag("prebuiltBinaries");

        throw err;
    } finally {
        await fixXpackPermissions();
    }
}

export async function getCompiledLlamaCppBinaryPath() {
    const compiledResultDirPath = await getCompiledResultDir();
    const modulePath = path.join(compiledResultDirPath, "llama-addon.node");

    if (await fs.pathExists(modulePath))
        return modulePath;

    return null;
}

async function getCompiledResultDir() {
    if (await fs.pathExists(path.join(llamaDirectory, "build", "Release"))) {
        return path.join(llamaDirectory, "build", "Release");
    } else if (await fs.pathExists(path.join(llamaDirectory, "build", "Debug"))) {
        return path.join(llamaDirectory, "build", "Debug");
    }

    throw new Error("Could not find Release or Debug directory");
}

async function getCmakePathArgs() {
    if (await hasBuiltinCmake())
        return [];

    const cmakePath = await getCmakePath();

    if (cmakePath == null)
        return [];

    return ["--cmake-path", cmakePath];
}
