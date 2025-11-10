package com.github.novicezk.midjourney.dto;

import com.github.novicezk.midjourney.enums.BlendDimensions;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@ApiModel("Blend Submission Parameters")
@EqualsAndHashCode(callSuper = true)
public class SubmitBlendDTO extends BaseSubmitDTO {

	@ApiModelProperty(value = "Base64 array of images", required = true, example = "[\"data:image/png;base64,xxx1\", \"data:image/png;base64,xxx2\"]")
	private List<String> base64Array;

	@ApiModelProperty(value = "Aspect ratio: PORTRAIT(2:3); SQUARE(1:1); LANDSCAPE(3:2)", example = "SQUARE")
	private BlendDimensions dimensions = BlendDimensions.SQUARE;
}
