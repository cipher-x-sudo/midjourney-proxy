package com.github.novicezk.midjourney.dto;

import com.github.novicezk.midjourney.enums.TaskAction;
import lombok.Data;
import lombok.EqualsAndHashCode;


@Data
@EqualsAndHashCode(callSuper = true)
public class SubmitChangeDTO extends BaseSubmitDTO {

	private String taskId;

	private TaskAction action;

	private Integer index;

}
