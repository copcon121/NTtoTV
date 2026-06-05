#property strict
#property copyright "SMC LuxAlgo 1:1 MT5 port"
#property version   "1.31"
#property description "SMC LuxAlgo 1:1 MT5 with structure, order blocks, FVG, EQH/EQL, premium/discount zones and HTF levels."
#property indicator_chart_window
#property indicator_plots 0

enum ENUM_SMC_MODE
{
   SMC_MODE_HISTORICAL = 0,
   SMC_MODE_PRESENT    = 1
};

enum ENUM_BREAK_MODE
{
   BREAK_ON_CLOSE = 0,
   BREAK_ON_WICK  = 1
};

enum ENUM_STRUCTURE_FILTER
{
   STRUCT_FILTER_ALL   = 0,
   STRUCT_FILTER_BOS   = 1,
   STRUCT_FILTER_CHOCH = 2
};

enum ENUM_LABEL_SIZE
{
   LABEL_TINY   = 0,
   LABEL_SMALL  = 1,
   LABEL_NORMAL = 2
};

enum ENUM_ORDER_BLOCK_FILTER
{
   ORDER_BLOCK_FILTER_ATR   = 0,
   ORDER_BLOCK_FILTER_RANGE = 1
};

enum ENUM_ZONE_MITIGATION
{
   MITIGATION_HIGHLOW = 0,
   MITIGATION_CLOSE   = 1
};

enum ENUM_SIMPLE_LINE_STYLE
{
   SIMPLE_LINE_SOLID  = 0,
   SIMPLE_LINE_DASHED = 1,
   SIMPLE_LINE_DOTTED = 2
};

struct StructureState
{
   int      trend;
   bool     hasHigh;
   bool     hasLow;
   bool     highBroken;
   bool     lowBroken;
   int      lastHighIndex;
   int      lastLowIndex;
   datetime lastHighTime;
   datetime lastLowTime;
   double   lastHighPrice;
   double   lastLowPrice;
   int      currentLeg;
};

struct ZoneRecord
{
   datetime t1;
   datetime t2;
   double   top;
   double   bottom;
   bool     bullish;
   bool     internal;
   string   label;
};

input group "Smart Money Concepts"
input ENUM_SMC_MODE   InpMode                      = SMC_MODE_HISTORICAL;
input int             InpLookbackBars              = 2000;
input ENUM_BREAK_MODE InpBreakMode                 = BREAK_ON_CLOSE;
input double          InpBreakBufferPoints         = 2.0;
input int             InpRangePeriod               = 20;

input group "Real Time Internal Structure"
input bool            InpShowInternalStructure     = true;
input bool            InpShowInternalSwingPoints   = false;
input int             InpInternalPivotLength       = 5;
input bool            InpFilterInternalBreaks      = false;
input ENUM_LABEL_SIZE InpInternalLabelSize         = LABEL_TINY;

input group "Real Time Swing Structure"
input bool            InpShowSwingStructure        = true;
input bool            InpShowSwingPoints           = false;
input int             InpSwingPivotLength          = 50;
input bool            InpShowStrongWeakLevels      = true;
input ENUM_STRUCTURE_FILTER InpSwingBullFilter     = STRUCT_FILTER_ALL;
input ENUM_STRUCTURE_FILTER InpSwingBearFilter     = STRUCT_FILTER_ALL;
input ENUM_LABEL_SIZE InpSwingLabelSize            = LABEL_SMALL;

input group "Order Blocks"
input bool            InpShowInternalOrderBlocks   = true;
input bool            InpShowSwingOrderBlocks      = false;
input int             InpMaxInternalOrderBlocks    = 10;
input int             InpMaxSwingOrderBlocks       = 5;
input int             InpOrderBlockExtendBars      = 220;
input double          InpOrderBlockRangeFilter     = 2.0;
input ENUM_ORDER_BLOCK_FILTER InpOrderBlockFilterMode = ORDER_BLOCK_FILTER_ATR;
input ENUM_ZONE_MITIGATION InpOrderBlockMitigation = MITIGATION_HIGHLOW;
input bool            InpHideMitigatedOrderBlocks = true;
input color           InpInternalBullishOBColor = C'25,35,45';
input color           InpInternalBearishOBColor = C'45,25,25';
input color           InpSwingBullishOBColor    = C'30,45,60';
input color           InpSwingBearishOBColor    = C'60,30,30';
input color           InpInternalBullishOBBorderColor = C'40,80,120';
input color           InpInternalBearishOBBorderColor = C'120,40,40';
input color           InpSwingBullishOBBorderColor    = C'50,100,150';
input color           InpSwingBearishOBBorderColor    = C'150,50,50';

input group "Fair Value Gaps"
input bool            InpShowFairValueGaps         = false;
input int             InpMaxFairValueGaps          = 10;
input bool            InpFairValueGapAutoThreshold = true;
input double          InpFairValueGapFactor        = 0.25;
input ENUM_TIMEFRAMES InpFairValueGapTimeframe     = PERIOD_CURRENT;
input int             InpFairValueGapExtendBars    = 1;

input group "EQH/EQL"
input bool            InpShowEqualHighsLows        = true;
input int             InpEqualConfirmationBars     = 3;
input double          InpEqualThresholdFactor      = 0.10;
input ENUM_LABEL_SIZE InpEqualLabelSize            = LABEL_TINY;

input group "Premium & Discount Zones"
input bool            InpShowPremiumDiscount       = false;
input bool            InpPremiumDiscountLiveRange  = true;

input group "Highs & Lows MTF"
input bool            InpShowDailyLevels           = false;
input ENUM_SIMPLE_LINE_STYLE InpDailyLevelsStyle   = SIMPLE_LINE_SOLID;
input color           InpDailyLevelsColor          = clrDodgerBlue;
input bool            InpShowWeeklyLevels          = false;
input ENUM_SIMPLE_LINE_STYLE InpWeeklyLevelsStyle  = SIMPLE_LINE_SOLID;
input color           InpWeeklyLevelsColor         = clrDodgerBlue;
input bool            InpShowMonthlyLevels         = false;
input ENUM_SIMPLE_LINE_STYLE InpMonthlyLevelsStyle = SIMPLE_LINE_SOLID;
input color           InpMonthlyLevelsColor        = clrDodgerBlue;

input group "Colors"
input color           InpBullColor                 = clrLimeGreen;
input color           InpBearColor                 = clrTomato;
input color           InpInternalBullColor         = clrDeepSkyBlue;
input color           InpInternalBearColor         = clrOrangeRed;
input color           InpEqualHighLowColor         = clrSilver;
input color           InpFvgBullColor              = C'45,145,90';
input color           InpFvgBearColor              = C'185,70,70';
input color           InpPremiumZoneColor          = C'45,25,25';
input color           InpDiscountZoneColor         = C'25,45,25';
input color           InpEquilibriumZoneColor      = C'40,40,40';

string g_basePrefix   = "";
string g_prefix       = "";
string g_activePrefix = "";
int    g_objectCounter = 0;
datetime g_lastRenderBarTime = 0;
double g_lastIntrabarHigh = 0.0;
double g_lastIntrabarLow  = 0.0;

int LabelFontSizeFromSetting(const ENUM_LABEL_SIZE size)
{
   if(size == LABEL_TINY)
      return 6;
   if(size == LABEL_NORMAL)
      return 10;
   return 8;
}

int LabelFontSize(const bool internal)
{
   return LabelFontSizeFromSetting(internal ? InpInternalLabelSize : InpSwingLabelSize);
}

ENUM_LINE_STYLE ResolveSimpleLineStyle(const ENUM_SIMPLE_LINE_STYLE style)
{
   if(style == SIMPLE_LINE_DASHED)
      return STYLE_DASH;
   if(style == SIMPLE_LINE_DOTTED)
      return STYLE_DOT;
   return STYLE_SOLID;
}

color ResolveDirectionalColor(const bool bullish, const bool internal)
{
   return bullish ? (internal ? InpInternalBullColor : InpBullColor)
                  : (internal ? InpInternalBearColor : InpBearColor);
}

color ResolveFvgColor(const bool bullish)
{
   color base = bullish ? InpFvgBullColor : InpFvgBearColor;
   int r = (int)(base & 0xFF);
   int g = (int)((base >> 8) & 0xFF);
   int b = (int)((base >> 16) & 0xFF);
   r = r + (255 - r) * 18 / 100;
   g = g + (255 - g) * 18 / 100;
   b = b + (255 - b) * 18 / 100;
   return (color)(r | (g << 8) | (b << 16));
}

color ResolveOrderBlockColor(const bool bullish, const bool internal)
{
   if(internal)
      return bullish ? InpInternalBullishOBColor : InpInternalBearishOBColor;

   return bullish ? InpSwingBullishOBColor : InpSwingBearishOBColor;
}

color ResolveOrderBlockBorderColor(const bool bullish, const bool internal)
{
   if(internal)
      return bullish ? InpInternalBullishOBBorderColor : InpInternalBearishOBBorderColor;

   return bullish ? InpSwingBullishOBBorderColor : InpSwingBearishOBBorderColor;
}

color ResolveEqualColor()
{
   return InpEqualHighLowColor;
}

bool StructureVisible(const bool internal, const bool bullish, const string kind)
{
   if(internal)
      return (kind == "CHoCH");

   ENUM_STRUCTURE_FILTER filter = STRUCT_FILTER_ALL;
   filter = bullish ? InpSwingBullFilter : InpSwingBearFilter;

   if(filter == STRUCT_FILTER_ALL)
      return true;
   if(filter == STRUCT_FILTER_BOS)
      return (kind == "BOS");
   return (kind == "CHoCH");
}

string NextName(const string tag)
{
   g_objectCounter++;
   return g_prefix + tag + "_" + IntegerToString(g_objectCounter);
}

string RenderPrefix(const bool primaryBuffer)
{
   return g_basePrefix + (primaryBuffer ? "A_" : "B_");
}

void ClearObjectsByPrefix(const string prefix)
{
   if(StringLen(prefix) == 0)
      return;

   ObjectsDeleteAll(0, prefix, -1, -1);
}

void ClearObjects()
{
   ClearObjectsByPrefix(RenderPrefix(true));
   ClearObjectsByPrefix(RenderPrefix(false));
   g_activePrefix = "";
}

void ApplyCommonStyle(const string name)
{
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   //--- BACK = true: force chart-space objects to render BEHIND candles
   //--- and BEHIND any pixel-coordinate panel (e.g. MT5 Trade Manager).
   //--- Without this, indicator objects re-created every tick get newer
   //--- creation timestamps than panel objects and visually cover them.
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
   ObjectSetInteger(0, name, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
}



void DrawTrendLine(const string name, datetime t1, double p1, datetime t2, double p2, color clr, ENUM_LINE_STYLE style, int width)
{
   if(!ObjectCreate(0, name, OBJ_TREND, 0, t1, p1, t2, p2))
      return;

   ApplyCommonStyle(name);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
   ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
}

void DrawTextLabel(const string name, datetime t, double price, const string text, color clr, int fontSize, ENUM_ANCHOR_POINT anchor)
{
   if(!ObjectCreate(0, name, OBJ_TEXT, 0, t, price))
      return;

   ApplyCommonStyle(name);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, anchor);
   ObjectSetString(0, name, OBJPROP_FONT, "Arial");
}

void DrawArrowMarker(const string name, datetime t, double price, color clr, bool bullish)
{
   if(!ObjectCreate(0, name, OBJ_ARROW, 0, t, price))
      return;

   ApplyCommonStyle(name);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 3);
   ObjectSetInteger(0, name, OBJPROP_ARROWCODE, bullish ? 241 : 242);
}

void DrawVerticalMarker(const string name, datetime t, color clr, ENUM_LINE_STYLE style, int width)
{
   if(!ObjectCreate(0, name, OBJ_VLINE, 0, t, 0))
      return;

   ApplyCommonStyle(name);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
}

void DrawRectangleZone(const string name, datetime t1, double top, datetime t2, double bottom, color clr, bool back = true, bool fill = true, ENUM_LINE_STYLE style = STYLE_SOLID)
{
   if(!ObjectCreate(0, name, OBJ_RECTANGLE, 0, t1, top, t2, bottom))
      return;

   ApplyCommonStyle(name);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_FILL, fill);
   //--- Force BACK=true regardless of caller intent so the rectangle
   //--- never covers external pixel-coord panels. The 'back' parameter
   //--- is kept for API compatibility but the rectangle always sits
   //--- behind candles now.
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
}

double AverageRangeAt(const int index, const int period, const int bars, const double &high[], const double &low[])
{
   double sum = 0.0;
   int count = 0;

   for(int i = index; i < bars && i < index + period; ++i)
   {
      sum += (high[i] - low[i]);
      count++;
   }

   if(count <= 0)
      return 0.0;

   return sum / (double)count;
}

int EffectiveLookbackBars()
{
   long firstVisible = ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0);
   long visibleBars = ChartGetInteger(0, CHART_VISIBLE_BARS, 0);
   int lookback = InpLookbackBars;
   if(visibleBars > 0)
      lookback = MathMin(lookback, (int)MathMax((long)300, MathMin((long)InpLookbackBars, visibleBars + 450)));
   else if(firstVisible > 0)
      lookback = MathMin(lookback, (int)MathMax((long)300, MathMin((long)InpLookbackBars, firstVisible + 300)));
   else
      lookback = MathMin(lookback, 1200);

   if(InpMode == SMC_MODE_PRESENT)
      lookback = MathMin(lookback, MathMax(160, InpSwingPivotLength * 4));

   return lookback;
}

double TrueRangeValueAt(const int index, const int bars, const double &high[], const double &low[], const double &close[])
{
   double previousClose = (index + 1 < bars) ? close[index + 1] : close[index];
   return MathMax(high[index] - low[index],
                  MathMax(MathAbs(high[index] - previousClose), MathAbs(low[index] - previousClose)));
}

double AverageTrueRangeAt(const int index, const int period, const int bars, const double &high[], const double &low[], const double &close[])
{
   double sum = 0.0;
   int count = 0;

   for(int i = index; i < bars && i < index + period; ++i)
   {
      sum += TrueRangeValueAt(i, bars, high, low, close);
      count++;
   }

   if(count <= 0)
      return 0.0;

   return sum / (double)count;
}

double CumulativeMeanTrueRangeAt(const int index, const int bars, const double &high[], const double &low[], const double &close[])
{
   double sum = 0.0;
   int count = 0;
   
   int limit = MathMin(bars - 1, index + 2000); // Prevent unbounded history loop
   for(int i = limit; i >= index; --i)
   {
      sum += TrueRangeValueAt(i, bars, high, low, close);
      count++;
   }

   if(count <= 0)
      return 0.0;

   return sum / (double)count;
}

bool IsPivotHigh(const int index, const int length, const int bars, const double &high[])
{
   if(index < length || index + length >= bars)
      return false;

   double pivot = high[index];
   for(int i = 1; i <= length; ++i)
   {
      if(pivot <= high[index - i] || pivot < high[index + i])
         return false;
   }

   return true;
}

bool IsPivotLow(const int index, const int length, const int bars, const double &low[])
{
   if(index < length || index + length >= bars)
      return false;

   double pivot = low[index];
   for(int i = 1; i <= length; ++i)
   {
      if(pivot >= low[index - i] || pivot > low[index + i])
         return false;
   }

   return true;
}

bool BreaksAbove(const int index, const double level, const double &close[], const double &high[])
{
   double buffer = InpBreakBufferPoints * _Point;
   if(InpBreakMode == BREAK_ON_WICK)
      return (high[index] > level + buffer);
   return (close[index] > level + buffer);
}

bool BreaksBelow(const int index, const double level, const double &close[], const double &low[])
{
   double buffer = InpBreakBufferPoints * _Point;
   if(InpBreakMode == BREAK_ON_WICK)
      return (low[index] < level - buffer);
   return (close[index] < level - buffer);
}

bool HasDisplacementBody(const int index, const bool bullish, const double &open[], const double &close[], const double &high[], const double &low[])
{
   double range = high[index] - low[index];
   if(range <= 0.0)
      return false;

   double body = MathAbs(close[index] - open[index]);
   if(body < range * 0.45)
      return false;

   if(bullish)
      return (close[index] > open[index]);
   return (close[index] < open[index]);
}

bool BullishConfluenceBar(const int index, const double &open[], const double &close[], const double &high[], const double &low[])
{
   double upperWick = high[index] - MathMax(close[index], open[index]);
   double lowerWick = MathMin(close[index], open[index]) - low[index];
   return upperWick > lowerWick;
}

bool BearishConfluenceBar(const int index, const double &open[], const double &close[], const double &high[], const double &low[])
{
   double upperWick = high[index] - MathMax(close[index], open[index]);
   double lowerWick = MathMin(close[index], open[index]) - low[index];
   return upperWick < lowerWick;
}

int FindLastOppositeCandle(const int startIndex, const int endIndex, const bool bullishBreak, const double &open[], const double &close[])
{
   int from = MathMax(startIndex, endIndex);
   int to   = MathMin(startIndex, endIndex);

   for(int i = from; i >= to; --i)
   {
      if(bullishBreak && close[i] < open[i])
         return i;
      if(!bullishBreak && close[i] > open[i])
         return i;
   }

   return -1;
}

double OrderBlockVolatilityAt(const int index, const int bars, const double &high[], const double &low[], const double &close[])
{
   if(InpOrderBlockFilterMode == ORDER_BLOCK_FILTER_ATR)
      return AverageTrueRangeAt(index, 200, bars, high, low, close);

   return CumulativeMeanTrueRangeAt(index, bars, high, low, close);
}

double ParsedHighAt(const int index, const int bars, const double &high[], const double &low[], const double &close[])
{
   double volatility = OrderBlockVolatilityAt(index, bars, high, low, close);
   bool highVolatilityBar = (high[index] - low[index]) >= (2.0 * volatility);
   return highVolatilityBar ? low[index] : high[index];
}

double ParsedLowAt(const int index, const int bars, const double &high[], const double &low[], const double &close[])
{
   double volatility = OrderBlockVolatilityAt(index, bars, high, low, close);
   bool highVolatilityBar = (high[index] - low[index]) >= (2.0 * volatility);
   return highVolatilityBar ? high[index] : low[index];
}

int FindOrderBlockParsedIndex(const int startIndex,
                              const int endIndex,
                              const bool bullishBreak,
                              const int bars,
                              const double &high[],
                              const double &low[],
                              const double &close[])
{
   int from = MathMax(startIndex, endIndex);
   int to   = MathMin(startIndex, endIndex);

   int bestIndex = -1;
   double bestValue = bullishBreak ? DBL_MAX : -DBL_MAX;

   for(int i = from; i >= to; --i)
   {
      double parsedHigh = ParsedHighAt(i, bars, high, low, close);
      double parsedLow  = ParsedLowAt(i, bars, high, low, close);

      if(bullishBreak)
      {
         if(parsedLow < bestValue)
         {
            bestValue = parsedLow;
            bestIndex = i;
         }
      }
      else
      {
         if(parsedHigh > bestValue)
         {
            bestValue = parsedHigh;
            bestIndex = i;
         }
      }
   }

   return bestIndex;
}

datetime ResolveOrderBlockEnd(const int breakIndex,
                              const bool bullishBreak,
                              const double zoneTop,
                              const double zoneBottom,
                              const datetime &time[],
                              const double &high[],
                              const double &low[],
                              const double &close[],
                              bool &mitigated)
{
   mitigated = false;

   for(int i = breakIndex - 1; i >= 0; --i)
   {
      double bearishMitigationSource = (InpOrderBlockMitigation == MITIGATION_CLOSE) ? close[i] : high[i];
      double bullishMitigationSource = (InpOrderBlockMitigation == MITIGATION_CLOSE) ? close[i] : low[i];

      if(!bullishBreak && bearishMitigationSource > zoneTop)
      {
         mitigated = true;
         return time[i];
      }

      if(bullishBreak && bullishMitigationSource < zoneBottom)
      {
         mitigated = true;
         return time[i];
      }
   }

   int futureIndex = breakIndex - InpOrderBlockExtendBars;
   if(futureIndex < 0)
      futureIndex = 0;
   return time[futureIndex];
}

datetime FindFirstTouchTime(const int breakIndex,
                            const double top,
                            const double bottom,
                            const bool closeBased,
                            const datetime &time[],
                            const double &high[],
                            const double &low[],
                            const double &close[])
{
   for(int i = breakIndex - 1; i >= 0; --i)
   {
      if(closeBased)
      {
         if(close[i] <= top && close[i] >= bottom)
            return time[i];
      }
      else if(high[i] >= bottom && low[i] <= top)
         return time[i];
   }

   return 0;
}

datetime ResolveZoneEnd(const int breakIndex,
                        const double top,
                        const double bottom,
                        const int extendBars,
                        const bool closeBased,
                        const datetime &time[],
                        const double &high[],
                        const double &low[],
                        const double &close[])
{
   datetime touched = FindFirstTouchTime(breakIndex, top, bottom, closeBased, time, high, low, close);
   if(touched > 0)
      return touched;

   int futureIndex = breakIndex - extendBars;
   if(futureIndex < 0)
      futureIndex = 0;
   return time[futureIndex];
}

datetime ResolveExtendedEndTime(const int breakIndex,
                                const int extendBars,
                                const datetime &time[])
{
   int futureIndex = breakIndex - extendBars;
   if(futureIndex < 0)
      futureIndex = 0;
   return time[futureIndex];
}

bool IsFvgFullyFilled(const int breakIndex,
                      const double top,
                      const double bottom,
                      const bool bullish,
                      const double &high[],
                      const double &low[])
{
   for(int i = breakIndex - 1; i >= 0; --i)
   {
      if(bullish)
      {
         if(low[i] < bottom)
            return true;
      }
      else
      {
         if(high[i] > top)
            return true;
      }
   }

   return false;
}

void AppendZone(ZoneRecord &zones[], datetime t1, datetime t2, double top, double bottom, bool bullish, bool internal, const string label)
{
   int size = ArraySize(zones);
   ArrayResize(zones, size + 1);
   zones[size].t1       = t1;
   zones[size].t2       = t2;
   zones[size].top      = top;
   zones[size].bottom   = bottom;
   zones[size].bullish  = bullish;
   zones[size].internal = internal;
   zones[size].label    = label;
}

void DrawZoneList(ZoneRecord &zones[], const int maxCount, const color bullColor, const color bearColor)
{
   int total = ArraySize(zones);
   int drawCount = maxCount;
   if(InpMode == SMC_MODE_PRESENT)
      drawCount = MathMin(drawCount, 1);

   int start = MathMax(0, total - drawCount);

   for(int i = start; i < total; ++i)
   {
      color clr = zones[i].bullish ? bullColor : bearColor;
      string rectName = NextName(zones[i].label + "_ZONE");
      DrawRectangleZone(rectName, zones[i].t1, zones[i].top, zones[i].t2, zones[i].bottom, clr, true, true);

      if(StringFind(zones[i].label, "OB") >= 0)
      {
         string borderName = NextName(zones[i].label + "_BORDER");
         color borderClr = ResolveOrderBlockBorderColor(zones[i].bullish, zones[i].internal);
         DrawRectangleZone(borderName, zones[i].t1, zones[i].top, zones[i].t2, zones[i].bottom, borderClr, false, false, STYLE_SOLID);
      }

      if(StringFind(zones[i].label, "FVG") < 0 && StringFind(zones[i].label, "OB") < 0)
      {
         color textClr = clr;
         string textName = NextName(zones[i].label + "_TXT");
         double mid = (zones[i].top + zones[i].bottom) * 0.5;
         DrawTextLabel(textName, zones[i].t2, mid, zones[i].label, textClr, LabelFontSize(zones[i].internal), ANCHOR_RIGHT_UPPER);
      }
   }
}

void DrawStructureBreak(const bool internal, const bool bullish, const string kind, datetime pivotTime, double pivotPrice, datetime breakTime, double avgRange)
{
   color clr = ResolveDirectionalColor(bullish, internal);

   string lineName = NextName("STRUCT_LINE");
   ENUM_LINE_STYLE style = internal ? STYLE_DOT : STYLE_SOLID;
   DrawTrendLine(lineName, pivotTime, pivotPrice, breakTime, pivotPrice, clr, style, internal ? 1 : 2);

   double textPrice = bullish ? (pivotPrice + avgRange * 0.15) : (pivotPrice - avgRange * 0.15);
   string textName = NextName("STRUCT_TXT");
   datetime midTime = pivotTime + (breakTime - pivotTime) / 2;
   DrawTextLabel(textName, midTime, textPrice, kind, clr, LabelFontSize(internal),
                 bullish ? ANCHOR_LOWER : ANCHOR_UPPER);
}

void DrawPivotTag(const bool internal, const bool isHigh, datetime when, double price, const string tag, double avgRange)
{
   color clr = ResolveDirectionalColor(!isHigh, internal);

   double y = isHigh ? price + avgRange * 0.12 : price - avgRange * 0.12;
   ENUM_ANCHOR_POINT anchor = isHigh ? ANCHOR_LOWER : ANCHOR_UPPER;
   string name = NextName("PIVOT");
   DrawTextLabel(name, when, y, tag, clr, LabelFontSize(internal), anchor);
}

void DrawEqualLevel(const bool isHigh, datetime t1, datetime t2, double price, double avgRange)
{
   string lineName = NextName(isHigh ? "EQH" : "EQL");
   DrawTrendLine(lineName, t1, price, t2, price, ResolveEqualColor(), STYLE_DOT, 1);

   string textName = NextName(isHigh ? "EQH_TXT" : "EQL_TXT");
   double y = isHigh ? price + avgRange * 0.05 : price - avgRange * 0.05;
   datetime midTime = t1 + (t2 - t1) / 2;
   DrawTextLabel(textName, midTime, y, isHigh ? "EQH" : "EQL", ResolveEqualColor(), LabelFontSizeFromSetting(InpEqualLabelSize), isHigh ? ANCHOR_LOWER : ANCHOR_UPPER);
}

void DrawCurrentLevel(const string text, datetime fromTime, datetime toTime, double price, color clr, bool upperSide, double avgRange)
{
   string lineName = NextName("CUR_LVL");
   DrawTrendLine(lineName, fromTime, price, toTime, price, clr, STYLE_DASHDOT, 2);

   string textName = NextName("CUR_TXT");
   double y = upperSide ? price + avgRange * 0.12 : price - avgRange * 0.12;
   DrawTextLabel(textName, toTime, y, text, clr, 8, upperSide ? ANCHOR_LOWER : ANCHOR_UPPER);
}

datetime FutureProjectionTime(const datetime &time[])
{
   if(ArraySize(time) > 1)
      return (datetime)(time[0] + 20 * (time[0] - time[1]));
   return time[0];
}

int FindHighestIndexSince(const int olderIndex, const double &high[])
{
   int bestIndex = olderIndex;
   for(int i = olderIndex; i >= 0; --i)
   {
      if(high[i] > high[bestIndex])
         bestIndex = i;
   }
   return bestIndex;
}

int FindLowestIndexSince(const int olderIndex, const double &low[])
{
   int bestIndex = olderIndex;
   for(int i = olderIndex; i >= 0; --i)
   {
      if(low[i] < low[bestIndex])
         bestIndex = i;
   }
   return bestIndex;
}

void DrawPremiumDiscount(const datetime startTime, const datetime endTime, const double highPrice, const double lowPrice)
{
   if(highPrice <= lowPrice)
      return;

   double eq = (highPrice + lowPrice) * 0.5;
   double premiumBottom = 0.95 * highPrice + 0.05 * lowPrice;
   double equilibriumTop = 0.525 * highPrice + 0.475 * lowPrice;
   double equilibriumBottom = 0.475 * highPrice + 0.525 * lowPrice;
   double discountTop = 0.95 * lowPrice + 0.05 * highPrice;

   string premName = NextName("PREMIUM");
   DrawRectangleZone(premName, startTime, highPrice, endTime, premiumBottom, InpPremiumZoneColor, true);

   string discName = NextName("DISCOUNT");
   DrawRectangleZone(discName, startTime, discountTop, endTime, lowPrice, InpDiscountZoneColor, true);

   string eqName = NextName("EQ");
   DrawRectangleZone(eqName, startTime, equilibriumTop, endTime, equilibriumBottom, InpEquilibriumZoneColor, true);

   datetime midTime = startTime + (endTime - startTime) / 2;
   DrawTextLabel(NextName("PREM_TXT"), midTime, highPrice, "Premium", InpBearColor, 8, ANCHOR_LOWER);
   DrawTextLabel(NextName("EQ_TXT"), endTime, eq, "EQ", clrSilver, 8, ANCHOR_RIGHT);
   DrawTextLabel(NextName("DISC_TXT"), midTime, lowPrice, "Discount", InpBullColor, 8, ANCHOR_UPPER);
}

bool ResolveSwingTrailingRange(const StructureState &state,
                               const datetime &time[],
                               const double &high[],
                               const double &low[],
                               datetime &anchorTime,
                               double &rangeHigh,
                               double &rangeLow,
                               datetime &rangeHighTime,
                               datetime &rangeLowTime,
                               const bool includeLiveRange = true)
{
   if(!state.hasHigh || !state.hasLow || state.lastHighIndex < 0 || state.lastLowIndex < 0)
      return false;

   int anchorIndex = (state.lastHighIndex < state.lastLowIndex) ? state.lastHighIndex : state.lastLowIndex;
   if(anchorIndex < 0)
      return false;

   anchorTime = time[anchorIndex];
   rangeHigh = state.lastHighPrice;
   rangeLow  = state.lastLowPrice;
   rangeHighTime = state.lastHighTime;
   rangeLowTime  = state.lastLowTime;

   if(includeLiveRange)
   {
      for(int i = anchorIndex; i >= 0; --i)
      {
         // Match the Pine trailing extremes behavior: preserve the opposite swing
         // and keep extending the range from the latest confirmed swing anchor.
         if(high[i] >= rangeHigh)
         {
            rangeHigh = high[i];
            rangeHighTime = time[i];
         }

         if(low[i] <= rangeLow)
         {
            rangeLow = low[i];
            rangeLowTime = time[i];
         }
      }
   }

   return (rangeHigh > rangeLow);
}

void DrawHTFLevel(const string tag, datetime fromTime, double price, color clr, ENUM_LINE_STYLE style, const datetime &time[])
{
   if(price <= 0.0)
      return;

   datetime rightTimeBar = FutureProjectionTime(time);
   string lineName = NextName(tag);
   DrawTrendLine(lineName, fromTime, price, rightTimeBar, price, clr, style, 1);
   DrawTextLabel(NextName(tag + "_TXT"), rightTimeBar, price, tag, clr, 8, ANCHOR_RIGHT);
}

void HandlePivotHigh(StructureState &state, const bool internal, const int index, const datetime &time[], const double &high[], const double &low[], const double &close[])
{
   double avgRange = AverageRangeAt(index, InpRangePeriod, ArraySize(high), high, low);

   if((internal && InpShowInternalSwingPoints) || (!internal && InpShowSwingPoints))
   {
      string tag = "H";
      if(state.hasHigh)
         tag = (high[index] > state.lastHighPrice) ? "HH" : "LH";
      DrawPivotTag(internal, true, time[index], high[index], tag, avgRange);
   }

   if(InpShowEqualHighsLows && state.hasHigh)
   {
      double threshold = MathMax(InpEqualThresholdFactor * AverageTrueRangeAt(index, 200, ArraySize(high), high, low, close), InpBreakBufferPoints * _Point);
      if(MathAbs(index - state.lastHighIndex) >= InpEqualConfirmationBars &&
         MathAbs(high[index] - state.lastHighPrice) <= threshold)
         DrawEqualLevel(true, state.lastHighTime, time[index], (high[index] + state.lastHighPrice) * 0.5, avgRange);
   }

   state.hasHigh      = true;
   state.highBroken   = false;
   state.lastHighIndex = index;
   state.lastHighTime  = time[index];
   state.lastHighPrice = high[index];
}

void HandlePivotLow(StructureState &state, const bool internal, const int index, const datetime &time[], const double &high[], const double &low[], const double &close[])
{
   double avgRange = AverageRangeAt(index, InpRangePeriod, ArraySize(high), high, low);

   if((internal && InpShowInternalSwingPoints) || (!internal && InpShowSwingPoints))
   {
      string tag = "L";
      if(state.hasLow)
         tag = (low[index] < state.lastLowPrice) ? "LL" : "HL";
      DrawPivotTag(internal, false, time[index], low[index], tag, avgRange);
   }

   if(InpShowEqualHighsLows && state.hasLow)
   {
      double threshold = MathMax(InpEqualThresholdFactor * AverageTrueRangeAt(index, 200, ArraySize(high), high, low, close), InpBreakBufferPoints * _Point);
      if(MathAbs(index - state.lastLowIndex) >= InpEqualConfirmationBars &&
         MathAbs(low[index] - state.lastLowPrice) <= threshold)
         DrawEqualLevel(false, state.lastLowTime, time[index], (low[index] + state.lastLowPrice) * 0.5, avgRange);
   }

   state.hasLow       = true;
   state.lowBroken    = false;
   state.lastLowIndex = index;
   state.lastLowTime  = time[index];
   state.lastLowPrice = low[index];
}

void TryCreateOrderBlock(const bool internal,
                         const bool bullishBreak,
                         const int searchStart,
                         const int breakIndex,
                         const datetime &time[],
                         const double &open[],
                         const double &high[],
                         const double &low[],
                         const double &close[],
                         ZoneRecord &zones[])
{
   if((internal && !InpShowInternalOrderBlocks) || (!internal && !InpShowSwingOrderBlocks))
      return;

   if(searchStart < 0 || breakIndex < 0)
      return;

   int bars = ArraySize(high);
   int obIndex = FindOrderBlockParsedIndex(searchStart, breakIndex, bullishBreak, bars, high, low, close);
   if(obIndex < 0)
      return;

   double avgRange = OrderBlockVolatilityAt(obIndex, bars, high, low, close);
   double candleRange = high[obIndex] - low[obIndex];
   if(avgRange > 0.0 && candleRange > avgRange * InpOrderBlockRangeFilter)
      return;

   double barHigh = ParsedHighAt(obIndex, bars, high, low, close);
   double barLow  = ParsedLowAt(obIndex, bars, high, low, close);
   double zoneTop = MathMax(barHigh, barLow);
   double zoneBottom = MathMin(barHigh, barLow);

   bool mitigated = false;
   datetime endTime = ResolveOrderBlockEnd(breakIndex,
                                           bullishBreak,
                                           zoneTop,
                                           zoneBottom,
                                           time,
                                           high,
                                           low,
                                           close,
                                           mitigated);

   if(InpHideMitigatedOrderBlocks && mitigated)
      return;

   string label = internal ? (bullishBreak ? "iBull OB" : "iBear OB")
                           : (bullishBreak ? "Bull OB" : "Bear OB");
   AppendZone(zones, time[obIndex], endTime, zoneTop, zoneBottom, bullishBreak, internal, label);
}

void TryBreakHigh(StructureState &state,
                  const StructureState &swingState,
                  const bool internal,
                  const int index,
                  const datetime &time[],
                  const double &open[],
                  const double &high[],
                  const double &low[],
                  const double &close[],
                  ZoneRecord &zones[])
{
   if(!state.hasHigh || state.highBroken)
      return;

   if(internal && InpFilterInternalBreaks)
   {
      bool extraCondition = (state.lastHighPrice != swingState.lastHighPrice) && BullishConfluenceBar(index, open, close, high, low);
      if(!extraCondition)
         return;
   }

   if(!BreaksAbove(index, state.lastHighPrice, close, high))
      return;

   double avgRange = AverageRangeAt(index, InpRangePeriod, ArraySize(high), high, low);
   string kind = (state.trend < 0) ? "CHoCH" : "BOS";
   if(StructureVisible(internal, true, kind))
      DrawStructureBreak(internal, true, kind, state.lastHighTime, state.lastHighPrice, time[index], avgRange);

   if(state.hasLow && (!internal || kind == "CHoCH"))
      TryCreateOrderBlock(internal, true, state.lastLowIndex, index, time, open, high, low, close, zones);

   state.highBroken = true;
   state.trend = 1;
}

void TryBreakLow(StructureState &state,
                 const StructureState &swingState,
                 const bool internal,
                 const int index,
                 const datetime &time[],
                 const double &open[],
                 const double &high[],
                 const double &low[],
                 const double &close[],
                 ZoneRecord &zones[])
{
   if(!state.hasLow || state.lowBroken)
      return;

   if(internal && InpFilterInternalBreaks)
   {
      bool extraCondition = (state.lastLowPrice != swingState.lastLowPrice) && BearishConfluenceBar(index, open, close, high, low);
      if(!extraCondition)
         return;
   }

   if(!BreaksBelow(index, state.lastLowPrice, close, low))
      return;

   double avgRange = AverageRangeAt(index, InpRangePeriod, ArraySize(high), high, low);
   string kind = (state.trend > 0) ? "CHoCH" : "BOS";
   if(StructureVisible(internal, false, kind))
      DrawStructureBreak(internal, false, kind, state.lastLowTime, state.lastLowPrice, time[index], avgRange);

   if(state.hasHigh && (!internal || kind == "CHoCH"))
      TryCreateOrderBlock(internal, false, state.lastHighIndex, index, time, open, high, low, close, zones);

   state.lowBroken = true;
   state.trend = -1;
}

void DetectFVG(const int index,
               const int bars,
               const datetime &time[],
               const double &high[],
               const double &low[],
               const double &close[],
               ZoneRecord &zones[])
{
   if(!InpShowFairValueGaps)
      return;

   if(index + 2 >= bars)
      return;

   double avgRange = AverageRangeAt(index + 2, InpRangePeriod, bars, high, low);
   double minGap = InpFairValueGapAutoThreshold ? (avgRange * InpFairValueGapFactor) : 0.0;

   if(low[index] > high[index + 2])
   {
      double top = low[index];
      double bottom = high[index + 2];
      if((top - bottom) >= minGap)
      {
         if(!IsFvgFullyFilled(index, top, bottom, true, high, low))
         {
            datetime endTime = ResolveExtendedEndTime(index, InpFairValueGapExtendBars, time);
            AppendZone(zones, time[index + 2], endTime, top, bottom, true, false, "Bull FVG");
         }
      }
   }

   if(high[index] < low[index + 2])
   {
      double top = low[index + 2];
      double bottom = high[index];
      if((top - bottom) >= minGap)
      {
         if(!IsFvgFullyFilled(index, top, bottom, false, high, low))
         {
            datetime endTime = ResolveExtendedEndTime(index, InpFairValueGapExtendBars, time);
            AppendZone(zones, time[index + 2], endTime, top, bottom, false, false, "Bear FVG");
         }
      }
   }
}

void BuildHigherTimeframeFVGZones(ZoneRecord &zones[], const int lookbackBars)
{
   if(!InpShowFairValueGaps)
      return;

   if(InpFairValueGapTimeframe == PERIOD_CURRENT || InpFairValueGapTimeframe == _Period)
      return;

   int requestBars = MathMax(lookbackBars + InpFairValueGapExtendBars + 50, 300);

   datetime tfTime[];
   double   tfHigh[];
   double   tfLow[];
   double   tfClose[];

   ArraySetAsSeries(tfTime, true);
   ArraySetAsSeries(tfHigh, true);
   ArraySetAsSeries(tfLow, true);
   ArraySetAsSeries(tfClose, true);

   int copiedTime  = CopyTime(_Symbol, InpFairValueGapTimeframe, 0, requestBars, tfTime);
   int copiedHigh  = CopyHigh(_Symbol, InpFairValueGapTimeframe, 0, requestBars, tfHigh);
   int copiedLow   = CopyLow(_Symbol, InpFairValueGapTimeframe, 0, requestBars, tfLow);
   int copiedClose = CopyClose(_Symbol, InpFairValueGapTimeframe, 0, requestBars, tfClose);

   int bars = MathMin(MathMin(copiedTime, copiedHigh), MathMin(copiedLow, copiedClose));
   if(bars < 5)
      return;

   int oldest = MathMin(bars - 3, lookbackBars - 1);
   for(int i = oldest; i >= 1; --i)
      DetectFVG(i, bars, tfTime, tfHigh, tfLow, tfClose, zones);
}

void ProcessPineLeg(const int i, const int size, const int bars, const double &high[], const double &low[], const double &close[], const datetime &time[], StructureState &state, const bool internal)
{
   if(i + size >= bars)
      return;

   double targetHigh = high[i + size];
   double targetLow  = low[i + size];
   
   double highestH = -DBL_MAX;
   double lowestL  = DBL_MAX;
   for(int j = 0; j < size; ++j)
   {
      double h = high[i + j];
      double l = low[i + j];
      if(h > highestH) highestH = h;
      if(l < lowestL)  lowestL  = l;
   }

   bool newLegHigh = (targetHigh > highestH);
   bool newLegLow  = (targetLow < lowestL);

   int leg = state.currentLeg;
   if(newLegHigh)
      leg = 0; // BEARISH_LEG
   else if(newLegLow)
      leg = 1; // BULLISH_LEG

   if(leg != state.currentLeg)
   {
      bool pivotLow = (leg == 1);
      bool pivotHigh = (leg == 0);
      state.currentLeg = leg;

      if(pivotLow)
         HandlePivotLow(state, internal, i + size, time, high, low, close);
      else if(pivotHigh)
         HandlePivotHigh(state, internal, i + size, time, high, low, close);
   }
}

int OnInit()
{
   g_basePrefix = "SMC1to1_" + _Symbol + "_" + IntegerToString((int)_Period) + "_";
   g_prefix = RenderPrefix(true);
   g_activePrefix = "";
   IndicatorSetString(INDICATOR_SHORTNAME, "SMC LuxAlgo 1:1 MT5");
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   ClearObjects();
}

int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   ArraySetAsSeries(time, true);
   ArraySetAsSeries(open, true);
   ArraySetAsSeries(high, true);
   ArraySetAsSeries(low, true);
   ArraySetAsSeries(close, true);
   ArraySetAsSeries(tick_volume, true);
   ArraySetAsSeries(volume, true);
   ArraySetAsSeries(spread, true);

   int minPivotLen = MathMin(InpSwingPivotLength, InpInternalPivotLength);

   if(rates_total <= minPivotLen + 5)
   {
      return 0;
   }

   bool sameBar = (prev_calculated > 0 && g_lastRenderBarTime == time[0]);
   if(sameBar)
   {
      bool wickChanged = (MathAbs(high[0] - g_lastIntrabarHigh) > (_Point * 0.1) ||
                          MathAbs(low[0] - g_lastIntrabarLow) > (_Point * 0.1));

      static uint last_tick_ms = 0;
      uint current_ms = GetTickCount();

      // Keep same-bar refresh limited to FVG wick changes so filled gaps disappear
      // intrabar without forcing a full redraw on every tick. Target max ~4 FPS redraw.
      if(!InpShowFairValueGaps || !wickChanged || (current_ms - last_tick_ms) < 250)
         return rates_total;
      
      last_tick_ms = current_ms;
   }

   g_lastRenderBarTime = time[0];
   g_lastIntrabarHigh = high[0];
   g_lastIntrabarLow = low[0];

   string nextPrefix = (g_activePrefix == RenderPrefix(true)) ? RenderPrefix(false) : RenderPrefix(true);
   ClearObjectsByPrefix(nextPrefix);
   g_prefix = nextPrefix;
   g_objectCounter = 0;

   StructureState swingState;
   StructureState internalState;
   ZeroMemory(swingState);
   ZeroMemory(internalState);
   swingState.trend = 0;
   internalState.trend = 0;
   swingState.lastHighIndex = -1;
   swingState.lastLowIndex = -1;
   internalState.lastHighIndex = -1;
   internalState.lastLowIndex = -1;
   swingState.currentLeg = 0;
   internalState.currentLeg = 0;

   ZoneRecord swingObZones[];
   ZoneRecord internalObZones[];
   ZoneRecord fvgZones[];

   int effectiveLookback = EffectiveLookbackBars();
   int oldest = MathMin(effectiveLookback - 1, rates_total - minPivotLen - 1);
   if(oldest < minPivotLen)
      oldest = minPivotLen;

   for(int i = oldest; i >= 0; --i)
   {
      if(InpShowSwingStructure)
      {
         ProcessPineLeg(i, InpSwingPivotLength, rates_total, high, low, close, time, swingState, false);

         TryBreakHigh(swingState, swingState, false, i, time, open, high, low, close, swingObZones);
         TryBreakLow(swingState, swingState, false, i, time, open, high, low, close, swingObZones);
      }

      if(InpShowInternalStructure)
      {
         ProcessPineLeg(i, InpInternalPivotLength, rates_total, high, low, close, time, internalState, true);

         TryBreakHigh(internalState, swingState, true, i, time, open, high, low, close, internalObZones);
         TryBreakLow(internalState, swingState, true, i, time, open, high, low, close, internalObZones);
      }

      if(InpShowFairValueGaps && (InpFairValueGapTimeframe == PERIOD_CURRENT || InpFairValueGapTimeframe == _Period))
         DetectFVG(i, rates_total, time, high, low, close, fvgZones);
   }

   if(InpShowSwingOrderBlocks || InpShowInternalOrderBlocks)
   {
      DrawZoneList(swingObZones, InpMaxSwingOrderBlocks, ResolveOrderBlockColor(true, false), ResolveOrderBlockColor(false, false));
      DrawZoneList(internalObZones, InpMaxInternalOrderBlocks, ResolveOrderBlockColor(true, true), ResolveOrderBlockColor(false, true));
   }

   if(InpShowFairValueGaps)
   {
      BuildHigherTimeframeFVGZones(fvgZones, effectiveLookback);
      DrawZoneList(fvgZones, InpMaxFairValueGaps, ResolveFvgColor(true), ResolveFvgColor(false));
   }

   if(InpShowStrongWeakLevels && InpShowSwingStructure && swingState.hasHigh && swingState.hasLow)
   {
      double avgRange = AverageRangeAt(0, InpRangePeriod, rates_total, high, low);
      datetime rightTimeBar = FutureProjectionTime(time);
      datetime zoneStart;
      datetime rangeHighTime;
      datetime rangeLowTime;
      double rangeHigh;
      double rangeLow;

      if(ResolveSwingTrailingRange(swingState, time, high, low, zoneStart, rangeHigh, rangeLow, rangeHighTime, rangeLowTime, true))
      {
         if(swingState.trend >= 0)
         {
            DrawCurrentLevel("Weak High", rangeHighTime, rightTimeBar, rangeHigh, ResolveDirectionalColor(false, false), true, avgRange);
            DrawCurrentLevel("Strong Low", rangeLowTime, rightTimeBar, rangeLow, ResolveDirectionalColor(true, false), false, avgRange);
         }
         else
         {
            DrawCurrentLevel("Strong High", rangeHighTime, rightTimeBar, rangeHigh, ResolveDirectionalColor(false, false), true, avgRange);
            DrawCurrentLevel("Weak Low", rangeLowTime, rightTimeBar, rangeLow, ResolveDirectionalColor(true, false), false, avgRange);
         }
      }
   }

   if(InpShowPremiumDiscount && InpShowSwingStructure && swingState.hasHigh && swingState.hasLow)
   {
      datetime zoneStart;
      datetime rangeHighTime;
      datetime rangeLowTime;
      double rangeHigh;
      double rangeLow;
      if(ResolveSwingTrailingRange(swingState, time, high, low, zoneStart, rangeHigh, rangeLow, rangeHighTime, rangeLowTime, InpPremiumDiscountLiveRange))
         DrawPremiumDiscount(zoneStart, time[0], rangeHigh, rangeLow);
   }

   if(InpShowDailyLevels)
   {
      datetime dStart = iTime(_Symbol, PERIOD_D1, 0);
      double pdh = iHigh(_Symbol, PERIOD_D1, 1);
      double pdl = iLow(_Symbol, PERIOD_D1, 1);
      DrawHTFLevel("PDH", dStart, pdh, InpDailyLevelsColor, ResolveSimpleLineStyle(InpDailyLevelsStyle), time);
      DrawHTFLevel("PDL", dStart, pdl, InpDailyLevelsColor, ResolveSimpleLineStyle(InpDailyLevelsStyle), time);
   }

   if(InpShowWeeklyLevels)
   {
      datetime wStart = iTime(_Symbol, PERIOD_W1, 0);
      double pwh = iHigh(_Symbol, PERIOD_W1, 1);
      double pwl = iLow(_Symbol, PERIOD_W1, 1);
      DrawHTFLevel("PWH", wStart, pwh, InpWeeklyLevelsColor, ResolveSimpleLineStyle(InpWeeklyLevelsStyle), time);
      DrawHTFLevel("PWL", wStart, pwl, InpWeeklyLevelsColor, ResolveSimpleLineStyle(InpWeeklyLevelsStyle), time);
   }

   if(InpShowMonthlyLevels)
   {
      datetime mStart = iTime(_Symbol, PERIOD_MN1, 0);
      double pmh = iHigh(_Symbol, PERIOD_MN1, 1);
      double pml = iLow(_Symbol, PERIOD_MN1, 1);
      DrawHTFLevel("PMH", mStart, pmh, InpMonthlyLevelsColor, ResolveSimpleLineStyle(InpMonthlyLevelsStyle), time);
      DrawHTFLevel("PML", mStart, pml, InpMonthlyLevelsColor, ResolveSimpleLineStyle(InpMonthlyLevelsStyle), time);
   }
   if(StringLen(g_activePrefix) > 0 && g_activePrefix != g_prefix)
      ClearObjectsByPrefix(g_activePrefix);
   g_activePrefix = g_prefix;
   return rates_total;
}

