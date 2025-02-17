import process from "process";
import path from "path";
import {removeNullFields} from "../utils/removeNullFields.js";
import {llamaCppNode, LLAMAModel} from "./LlamaBins.js";


export type LlamaModelOptions = {
    /** path to the model on the filesystem */
    modelPath: string,

    /** If null, a random seed will be used */
    seed?: number | null,

    /** text context size */
    contextSize?: number,

    /** prompt processing batch size */
    batchSize?: number,

    /** number of layers to store in VRAM */
    gpuLayers?: number,

    /** if true, reduce VRAM usage at the cost of performance */
    lowVram?: boolean,

    /** number of threads to use to evaluate tokens */
    threads?: number,

    /**
     * Temperature is a hyperparameter that controls the randomness of the generated text.
     * It affects the probability distribution of the model's output tokens.
     * A higher temperature (e.g., 1.5) makes the output more random and creative,
     * while a lower temperature (e.g., 0.5) makes the output more focused, deterministic, and conservative.
     * The suggested temperature is 0.8, which provides a balance between randomness and determinism.
     * At the extreme, a temperature of 0 will always pick the most likely next token, leading to identical outputs in each run.
     *
     * Set to `0` to disable.
     */
    temperature?: number,

    /**
     * Limits the model to consider only the K most likely next tokens for sampling at each step of sequence generation.
     * An integer number between `1` and the size of the vocabulary.
     * Set to `0` to disable (which uses the full vocabulary).
     *
     * Only relevant when `temperature` is set to a value greater than 0.
     * */
    topK?: number,

    /**
     * Dynamically selects the smallest set of tokens whose cumulative probability exceeds the threshold P,
     * and samples the next token only from this set.
     * A float number between `0` and `1`.
     * Set to `1` to disable.
     *
     * Only relevant when `temperature` is set to a value greater than `0`.
     * */
    topP?: number,

    /** use fp16 for KV cache */
    f16Kv?: boolean,

    /** the llama_eval() call computes all logits, not just the last one */
    logitsAll?: boolean,

    /** only load the vocabulary, no weights */
    vocabOnly?: boolean,

    /** use mmap if possible */
    useMmap?: boolean,

    /** force system to keep model in RAM */
    useMlock?: boolean,

    /** embedding mode only */
    embedding?: boolean
};

export class LlamaModel {
    /** @internal */
    public readonly _model: LLAMAModel;

    /**
     * options source:
     * https://github.com/ggerganov/llama.cpp/blob/b5ffb2849d23afe73647f68eec7b68187af09be6/llama.h#L102 (struct llama_context_params)
     * @param {object} options
     * @param {string} options.modelPath - path to the model on the filesystem
     * @param {number | null} [options.seed] - If null, a random seed will be used
     * @param {number} [options.contextSize] - text context size
     * @param {number} [options.batchSize] - prompt processing batch size
     * @param {number} [options.gpuLayers] - number of layers to store in VRAM
     * @param {boolean} [options.lowVram] - if true, reduce VRAM usage at the cost of performance
     * @param {number} [options.threads] - number of threads to use to evaluate tokens
     * @param {number} [options.temperature] - Temperature is a hyperparameter that controls the randomness of the generated text.
     * It affects the probability distribution of the model's output tokens.
     * A higher temperature (e.g., 1.5) makes the output more random and creative,
     * while a lower temperature (e.g., 0.5) makes the output more focused, deterministic, and conservative.
     * The suggested temperature is 0.8, which provides a balance between randomness and determinism.
     * At the extreme, a temperature of 0 will always pick the most likely next token, leading to identical outputs in each run.
     *
     * Set to `0` to disable.
     * @param {number} [options.topK] - Limits the model to consider only the K most likely next tokens for sampling at each step of
     * sequence generation.
     * An integer number between `1` and the size of the vocabulary.
     * Set to `0` to disable (which uses the full vocabulary).
     *
     * Only relevant when `temperature` is set to a value greater than 0.
     * @param {number} [options.topP] - Dynamically selects the smallest set of tokens whose cumulative probability exceeds the threshold P,
     * and samples the next token only from this set.
     * A float number between `0` and `1`.
     * Set to `1` to disable.
     *
     * Only relevant when `temperature` is set to a value greater than `0`.
     * @param {boolean} [options.f16Kv] - use fp16 for KV cache
     * @param {boolean} [options.logitsAll] - the llama_eval() call computes all logits, not just the last one
     * @param {boolean} [options.vocabOnly] - only load the vocabulary, no weights
     * @param {boolean} [options.useMmap] - use mmap if possible
     * @param {boolean} [options.useMlock] - force system to keep model in RAM
     * @param {boolean} [options.embedding] - embedding mode only
     */
    public constructor({
        modelPath, seed = null, contextSize = 1024 * 4, batchSize, gpuLayers,
        lowVram, threads = 6, temperature = 0, topK = 40, topP = 0.95, f16Kv, logitsAll, vocabOnly, useMmap, useMlock, embedding
    }: LlamaModelOptions) {
        this._model = new LLAMAModel(path.resolve(process.cwd(), modelPath), removeNullFields({
            seed: seed != null ? Math.max(-1, seed) : undefined,
            contextSize,
            batchSize,
            gpuLayers,
            lowVram,
            threads,
            temperature,
            topK,
            topP,
            f16Kv,
            logitsAll,
            vocabOnly,
            useMmap,
            useMlock,
            embedding
        }));
    }

    public static get systemInfo() {
        return llamaCppNode.systemInfo();
    }
}
