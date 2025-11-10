package com.github.novicezk.midjourney.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;


@Data
@ApiModel("Variation Task Submission Parameters - Simple")
@EqualsAndHashCode(callSuper = true)
public class SubmitSimpleChangeDTO extends BaseSubmitDTO {

	@ApiModelProperty(value = "Variation description: ID $action$index", required = true, example = "1320098173412546 U2")
	private String content;

}
