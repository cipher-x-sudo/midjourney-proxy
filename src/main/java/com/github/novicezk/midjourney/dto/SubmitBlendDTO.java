package com.github.novicezk.midjourney.dto;

import com.github.novicezk.midjourney.enums.BlendDimensions;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class SubmitBlendDTO extends BaseSubmitDTO {

	private List<String> base64Array;

	private BlendDimensions dimensions = BlendDimensions.SQUARE;
}
