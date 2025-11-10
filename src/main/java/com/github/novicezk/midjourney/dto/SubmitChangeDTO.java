package com.github.novicezk.midjourney.dto;

import com.github.novicezk.midjourney.enums.TaskAction;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;


@Data
@ApiModel("Variation Task Submission Parameters")
@EqualsAndHashCode(callSuper = true)
public class SubmitChangeDTO extends BaseSubmitDTO {

	@ApiModelProperty(value = "Task ID", required = true, example = "\"1320098173412546\"")
	private String taskId;

	@ApiModelProperty(value = "UPSCALE(Enlarge); VARIATION(Variation); REROLL(Regenerate)", required = true,
			allowableValues = "UPSCALE, VARIATION, REROLL", example = "UPSCALE")
	private TaskAction action;

	@ApiModelProperty(value = "Index (1~4), required when action is UPSCALE or VARIATION", allowableValues = "range[1, 4]", example = "1")
	private Integer index;

}
