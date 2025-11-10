package com.github.novicezk.midjourney.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@ApiModel("Describe Submission Parameters")
@EqualsAndHashCode(callSuper = true)
public class SubmitDescribeDTO extends BaseSubmitDTO {

	@ApiModelProperty(value = "Image base64", required = true, example = "data:image/png;base64,xxx")
	private String base64;
}
