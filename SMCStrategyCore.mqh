#ifndef __SMC_STRATEGY_CORE_MQH__
#define __SMC_STRATEGY_CORE_MQH__

struct SmcStructureState
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

struct SmcStructureEvent
{
   int      index;
   datetime pivotTime;
   double   pivotPrice;
   datetime breakTime;
   bool     bullish;
   bool     internal;
   bool     choch;
   int      pivotLength;
};

struct SmcFvgZone
{
   int      index;
   datetime startTime;
   datetime endTime;
   double   top;
   double   bottom;
   bool     bullish;
};

double SmcAverageRangeAt(const int index,
                         const int period,
                         const int bars,
                         const double &high[],
                         const double &low[])
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

bool SmcIsPivotHigh(const int index,
                    const int length,
                    const int bars,
                    const double &high[])
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

bool SmcIsPivotLow(const int index,
                   const int length,
                   const int bars,
                   const double &low[])
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

bool SmcBreaksAbove(const int index,
                    const double level,
                    const double &close[],
                    const double &high[],
                    const double breakBufferPoints,
                    const double pointValue,
                    const bool breakOnWick)
{
   double buffer = breakBufferPoints * pointValue;
   if(breakOnWick)
      return (high[index] > level + buffer);
   return (close[index] > level + buffer);
}

bool SmcBreaksBelow(const int index,
                    const double level,
                    const double &close[],
                    const double &low[],
                    const double breakBufferPoints,
                    const double pointValue,
                    const bool breakOnWick)
{
   double buffer = breakBufferPoints * pointValue;
   if(breakOnWick)
      return (low[index] < level - buffer);
   return (close[index] < level - buffer);
}

datetime SmcResolveExtendedEndTime(const int breakIndex,
                                   const int extendBars,
                                   const datetime &time[])
{
   int futureIndex = breakIndex - extendBars;
   if(futureIndex < 0)
      futureIndex = 0;
   return time[futureIndex];
}

bool SmcIsFvgFullyFilled(const int breakIndex,
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

bool SmcTryDetectFvgAt(const int index,
                       const int bars,
                       const datetime &time[],
                       const double &high[],
                       const double &low[],
                       const double &close[],
                       const int rangePeriod,
                       const bool autoThreshold,
                       const double gapFactor,
                       const int extendBars,
                       SmcFvgZone &zone)
{
   if(index + 2 >= bars)
      return false;

   double avgRange = SmcAverageRangeAt(index + 2, rangePeriod, bars, high, low);
   double minGap = autoThreshold ? (avgRange * gapFactor) : 0.0;

   if(low[index] > high[index + 2])
   {
      double top = low[index];
      double bottom = high[index + 2];
      if((top - bottom) >= minGap && !SmcIsFvgFullyFilled(index, top, bottom, true, high, low))
      {
         zone.index = index;
         zone.startTime = time[index + 2];
         zone.endTime = SmcResolveExtendedEndTime(index, extendBars, time);
         zone.top = top;
         zone.bottom = bottom;
         zone.bullish = true;
         return true;
      }
   }

   if(high[index] < low[index + 2])
   {
      double top = low[index + 2];
      double bottom = high[index];
      if((top - bottom) >= minGap && !SmcIsFvgFullyFilled(index, top, bottom, false, high, low))
      {
         zone.index = index;
         zone.startTime = time[index + 2];
         zone.endTime = SmcResolveExtendedEndTime(index, extendBars, time);
         zone.top = top;
         zone.bottom = bottom;
         zone.bullish = false;
         return true;
      }
   }

   return false;
}

bool SmcTryDetectBearishFvgAt(const int index,
                              const int bars,
                              const datetime &time[],
                              const double &high[],
                              const double &low[],
                              const double &close[],
                              const int rangePeriod,
                              const bool autoThreshold,
                              const double gapFactor,
                              const int extendBars,
                              SmcFvgZone &zone)
{
   if(!SmcTryDetectFvgAt(index, bars, time, high, low, close, rangePeriod, autoThreshold, gapFactor, extendBars, zone))
      return false;

   return (!zone.bullish);
}

void SmcResetStructureState(SmcStructureState &state)
{
   ZeroMemory(state);
   state.lastHighIndex = -1;
   state.lastLowIndex = -1;
}

void SmcUpdatePivotHigh(SmcStructureState &state,
                        const int index,
                        const datetime &time[],
                        const double &high[])
{
   state.hasHigh = true;
   state.highBroken = false;
   state.lastHighIndex = index;
   state.lastHighTime = time[index];
   state.lastHighPrice = high[index];
}

void SmcUpdatePivotLow(SmcStructureState &state,
                       const int index,
                       const datetime &time[],
                       const double &low[])
{
   state.hasLow = true;
   state.lowBroken = false;
   state.lastLowIndex = index;
   state.lastLowTime = time[index];
   state.lastLowPrice = low[index];
}

void SmcProcessPineLeg(const int i,
                       const int size,
                       const int bars,
                       const double &high[],
                       const double &low[],
                       const datetime &time[],
                       SmcStructureState &state)
{
   if(i + size >= bars)
      return;

   double targetHigh = high[i + size];
   double targetLow = low[i + size];

   double highestH = -DBL_MAX;
   double lowestL = DBL_MAX;
   for(int j = 0; j < size; ++j)
   {
      double h = high[i + j];
      double l = low[i + j];
      if(h > highestH)
         highestH = h;
      if(l < lowestL)
         lowestL = l;
   }

   bool newLegHigh = (targetHigh > highestH);
   bool newLegLow = (targetLow < lowestL);

   int leg = state.currentLeg;
   if(newLegHigh)
      leg = 0;
   else if(newLegLow)
      leg = 1;

   if(leg != state.currentLeg)
   {
      bool pivotLow = (leg == 1);
      bool pivotHigh = (leg == 0);
      state.currentLeg = leg;

      if(pivotLow)
         SmcUpdatePivotLow(state, i + size, time, low);
      else if(pivotHigh)
         SmcUpdatePivotHigh(state, i + size, time, high);
   }
}

bool SmcTryBreakHigh(SmcStructureState &state,
                     const bool internal,
                     const int pivotLength,
                     const int index,
                     const datetime &time[],
                     const double &close[],
                     const double &high[],
                     const double breakBufferPoints,
                     const double pointValue,
                     const bool breakOnWick,
                     SmcStructureEvent &eventOut)
{
   if(!state.hasHigh || state.highBroken)
      return false;

   if(!SmcBreaksAbove(index, state.lastHighPrice, close, high, breakBufferPoints, pointValue, breakOnWick))
      return false;

   eventOut.index = index;
   eventOut.pivotTime = state.lastHighTime;
   eventOut.pivotPrice = state.lastHighPrice;
   eventOut.breakTime = time[index];
   eventOut.bullish = true;
   eventOut.internal = internal;
   eventOut.choch = (state.trend < 0);
   eventOut.pivotLength = pivotLength;

   state.highBroken = true;
   state.trend = 1;
   return true;
}

bool SmcTryBreakLow(SmcStructureState &state,
                    const bool internal,
                    const int pivotLength,
                    const int index,
                    const datetime &time[],
                    const double &close[],
                    const double &low[],
                    const double breakBufferPoints,
                    const double pointValue,
                    const bool breakOnWick,
                    SmcStructureEvent &eventOut)
{
   if(!state.hasLow || state.lowBroken)
      return false;

   if(!SmcBreaksBelow(index, state.lastLowPrice, close, low, breakBufferPoints, pointValue, breakOnWick))
      return false;

   eventOut.index = index;
   eventOut.pivotTime = state.lastLowTime;
   eventOut.pivotPrice = state.lastLowPrice;
   eventOut.breakTime = time[index];
   eventOut.bullish = false;
   eventOut.internal = internal;
   eventOut.choch = (state.trend > 0);
   eventOut.pivotLength = pivotLength;

   state.lowBroken = true;
   state.trend = -1;
   return true;
}

void SmcAppendEvent(SmcStructureEvent &events[],
                    const SmcStructureEvent &eventItem)
{
   int size = ArraySize(events);
   ArrayResize(events, size + 1);
   events[size] = eventItem;
}

int SmcCollectStructureEvents(const int pivotLength,
                              const bool internal,
                              const int bars,
                              const datetime &time[],
                              const double &high[],
                              const double &low[],
                              const double &close[],
                              const double breakBufferPoints,
                              const double pointValue,
                              const bool breakOnWick,
                              SmcStructureEvent &events[])
{
   ArrayResize(events, 0);
   if(bars <= pivotLength + 5)
      return 0;

   SmcStructureState state;
   SmcResetStructureState(state);

   int oldest = bars - pivotLength - 1;
   for(int i = oldest; i >= 0; --i)
   {
      SmcProcessPineLeg(i, pivotLength, bars, high, low, time, state);

      SmcStructureEvent eventItem;
      if(SmcTryBreakHigh(state, internal, pivotLength, i, time, close, high, breakBufferPoints, pointValue, breakOnWick, eventItem))
         SmcAppendEvent(events, eventItem);
      if(SmcTryBreakLow(state, internal, pivotLength, i, time, close, low, breakBufferPoints, pointValue, breakOnWick, eventItem))
         SmcAppendEvent(events, eventItem);
   }

   return ArraySize(events);
}

bool SmcWasBullRangeFilledByLaterBar(const int signalIndex,
                                     const int latestAllowedIndex,
                                     const double signalHigh,
                                     const double signalLow,
                                     const double &high[],
                                     const double &low[])
{
   int start = signalIndex - 1;
   if(start < latestAllowedIndex)
      return false;

   for(int i = start; i >= latestAllowedIndex && i >= 0; --i)
   {
      if(high[i] >= signalHigh && low[i] <= signalLow)
         return true;
   }

   return false;
}

#endif
