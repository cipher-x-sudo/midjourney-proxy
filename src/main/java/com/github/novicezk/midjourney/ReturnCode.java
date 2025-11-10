package com.github.novicezk.midjourney;

import lombok.experimental.UtilityClass;

@UtilityClass
public final class ReturnCode {
	/**
	 * Success.
	 */
	public static final int SUCCESS = 1;
	/**
	 * Data not found.
	 */
	public static final int NOT_FOUND = 3;
	/**
	 * Validation error.
	 */
	public static final int VALIDATION_ERROR = 4;
	/**
	 * System error.
	 */
	public static final int FAILURE = 9;

	/**
	 * Already exists.
	 */
	public static final int EXISTED = 21;
	/**
	 * In queue.
	 */
	public static final int IN_QUEUE = 22;
	/**
	 * Queue is full.
	 */
	public static final int QUEUE_REJECTED = 23;
	/**
	 * Prompt contains sensitive words.
	 */
	public static final int BANNED_PROMPT = 24;


}