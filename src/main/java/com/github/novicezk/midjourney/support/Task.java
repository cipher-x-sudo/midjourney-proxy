package com.github.novicezk.midjourney.support;

import com.github.novicezk.midjourney.domain.DomainObject;
import com.github.novicezk.midjourney.enums.TaskAction;
import com.github.novicezk.midjourney.enums.TaskStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serial;

@Data
@EqualsAndHashCode(callSuper = true)
public class Task extends DomainObject {
	@Serial
	private static final long serialVersionUID = -674915748204390789L;

	private TaskAction action;
	private TaskStatus status = TaskStatus.NOT_START;

	private String prompt;
	private String promptEn;

	private String description;
	private String state;

	private Long submitTime;
	private Long startTime;
	private Long finishTime;

	private String imageUrl;

	private String progress;
	private String failReason;

	public void start() {
		this.startTime = System.currentTimeMillis();
		this.status = TaskStatus.SUBMITTED;
		this.progress = "0%";
	}

	public void success() {
		this.finishTime = System.currentTimeMillis();
		this.status = TaskStatus.SUCCESS;
		this.progress = "100%";
	}

	public void fail(String reason) {
		this.finishTime = System.currentTimeMillis();
		this.status = TaskStatus.FAILURE;
		this.failReason = reason;
		this.progress = "";
	}
}
