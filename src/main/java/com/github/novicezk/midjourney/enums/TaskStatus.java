package com.github.novicezk.midjourney.enums;


import lombok.Getter;

public enum TaskStatus {
	/**
	 * Not started.
	 */
	NOT_START(0),
	/**
	 * Submitted.
	 */
	SUBMITTED(1),
	/**
	 * In progress.
	 */
	IN_PROGRESS(3),
	/**
	 * Failed.
	 */
	FAILURE(4),
	/**
	 * Success.
	 */
	SUCCESS(4);

	@Getter
	private final int order;

	TaskStatus(int order) {
		this.order = order;
	}

}
