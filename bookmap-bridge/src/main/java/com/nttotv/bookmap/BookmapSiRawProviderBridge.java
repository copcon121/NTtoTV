package com.nttotv.bookmap;

import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyName;

@Layer1SimpleAttachable
@Layer1StrategyName("NTtoTV Bookmap SI Raw Provider Bridge")
@Layer1ApiVersion(Layer1ApiVersionValue.VERSION2)
public class BookmapSiRawProviderBridge extends BookmapSiBridge {
}
