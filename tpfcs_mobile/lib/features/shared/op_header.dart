import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

class OpHeader extends StatelessWidget {
  final bool dark;
  final String title, subtitle;
  final IconData icon;
  final Color gradStart, gradEnd, symbolColor;
  final int step, totalSteps;
  final List<String> stepLabels;
  final VoidCallback onBack;

  const OpHeader({
    super.key,
    required this.dark, required this.title, required this.subtitle,
    required this.icon, required this.gradStart, required this.gradEnd,
    required this.symbolColor, required this.step, required this.totalSteps,
    required this.stepLabels, required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    final gradient = dark
        ? LinearGradient(colors: [gradStart.withOpacity(0.35), gradEnd.withOpacity(0.20)],
            begin: Alignment.topLeft, end: Alignment.bottomRight)
        : LinearGradient(colors: [gradStart, gradEnd],
            begin: Alignment.topLeft, end: Alignment.bottomRight);

    final labelColor = dark ? Colors.white : AppColors.navy;
    final subColor   = dark ? Colors.white.withOpacity(0.65) : AppColors.navy.withOpacity(0.6);
    final backColor  = dark ? Colors.white.withOpacity(0.8)  : AppColors.navy.withOpacity(0.8);

    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        border: dark ? Border(bottom: BorderSide(color: gradStart.withOpacity(0.35))) : null,
      ),
      child: SafeArea(
        bottom: false,
        child: ClipRect(
          child: Stack(children: [
            Positioned(right: -20, top: -10,
              child: Icon(icon, size: 130,
                color: symbolColor.withOpacity(dark ? 0.20 : 0.15))),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 16, 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  IconButton(
                    icon: Icon(Icons.arrow_back_rounded, color: backColor),
                    onPressed: onBack),
                ]),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      // Left: operation icon chip
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: dark ? symbolColor.withOpacity(0.25) : Colors.white.withOpacity(0.5),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: dark
                              ? symbolColor.withOpacity(0.4)
                              : AppColors.navy.withOpacity(0.15)),
                        ),
                        child: Icon(icon, color: dark ? symbolColor : AppColors.navy, size: 22),
                      ),
                      const Spacer(),
                      // Right: brand logo chip
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: dark ? Colors.white.withOpacity(0.12) : Colors.white.withOpacity(0.6),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: dark
                              ? Colors.white.withOpacity(0.2)
                              : AppColors.navy.withOpacity(0.15)),
                        ),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          ClipOval(child: Image.asset('assets/images/logo.png',
                            width: 20, height: 20, fit: BoxFit.cover)),
                          const SizedBox(width: 7),
                          Text('TPFCS', style: TextStyle(
                            color: dark ? Colors.white : AppColors.navy,
                            fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.5)),
                        ]),
                      ),
                    ]),
                    const SizedBox(height: 10),
                    Text(title, style: TextStyle(
                      color: labelColor, fontSize: 22,
                      fontWeight: FontWeight.w900, letterSpacing: -0.3)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(color: subColor, fontSize: 12)),
                    const SizedBox(height: 16),
                    StepIndicator(current: step, total: totalSteps, labels: stepLabels),
                    const SizedBox(height: 4),
                  ]),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
