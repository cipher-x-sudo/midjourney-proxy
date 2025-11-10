package com.github.novicezk.midjourney.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;


@Data
@ApiModel("Imagine Submission Parameters")
@EqualsAndHashCode(callSuper = true)
public class SubmitImagineDTO extends BaseSubmitDTO {

	@ApiModelProperty(value = "Prompt", required = true, example = "Cat")
	private String prompt;

	@ApiModelProperty(value = "Base64 array of reference images")
	private List<String> base64Array;

	@ApiModelProperty(hidden = true)
	@Deprecated(since = "3.0", forRemoval = true)
	private String base64;

}
